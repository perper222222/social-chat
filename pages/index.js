"use client";

import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  addDoc,
  onSnapshot,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const avatarColors = [
  "#FF6B6B", "#6BCB77", "#4D96FF", "#FFD93D", "#C77DFF",
  "#FF8E72", "#4ADEDE", "#FF9F1C", "#2EC4B6", "#E71D36"
];

const getAvatarColor = (userId) => {
  if (!userId) return avatarColors[0];
  const index = parseInt(userId, 10) % avatarColors.length;
  return avatarColors[index];
};

export default function Home() {
  // --- 用户输入ID和组号 ---
  const [userId, setUserId] = useState("");
  const [groupNum, setGroupNum] = useState("");
  const [entered, setEntered] = useState(false);

  // --- 发布消息和消息列表 ---
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentsData, setCommentsData] = useState({});

  // --- 计时 ---
  const [timeLeft, setTimeLeft] = useState(240); // 4分钟倒计时（秒）
  const timerRef = useRef(null);

  // --- 用户是否已经发过第一条消息，允许查看别人内容 ---
  const [hasPosted, setHasPosted] = useState(false);

  // 监听倒计时
  useEffect(() => {
    if (!entered) return;

    if (timeLeft <= 0) {
      alert("시간이 종료되어 자동으로 페이지를 종료합니다.");
      window.location.reload();
      return;
    }

    timerRef.current = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timerRef.current);
  }, [timeLeft, entered]);

  // 进入后订阅消息，但根据hasPosted判断是否显示
  useEffect(() => {
    if (!entered) return;

    // 只拉取同组(groupNum)消息
    const q = query(
      collection(db, "messages"),
      where("groupNum", "==", groupNum),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [entered, groupNum]);

  // 展开所有评论
  useEffect(() => {
    if (!entered || !hasPosted) return;

    setOpenComments(
      messages.reduce((acc, msg) => {
        acc[msg.id] = true;
        return acc;
      }, {})
    );
  }, [messages, entered, hasPosted]);

  // 监听评论区
  useEffect(() => {
    if (!entered || !hasPosted) return;

    const unsubscribes = Object.entries(openComments)
      .filter(([, isOpen]) => isOpen)
      .map(([msgId]) => {
        const q = query(
          collection(db, "messages", msgId, "comments"),
          orderBy("timestamp", "asc")
        );
        return onSnapshot(q, (snapshot) => {
          const comms = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setCommentsData((prev) => ({ ...prev, [msgId]: comms }));
        });
      });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [openComments, entered, hasPosted]);

  // 发送消息
  const sendMessage = async () => {
    if (!message.trim()) return;

    await addDoc(collection(db, "messages"), {
      userId,
      groupNum,
      text: message.trim(),
      timestamp: serverTimestamp(),
      likes: [],
    });
    setMessage("");
    setHasPosted(true);
  };

  // 点赞/取消点赞
  const toggleLike = async (msg) => {
    const msgRef = doc(db, "messages", msg.id);
    const hasLiked = msg.likes?.includes(userId);

    if (hasLiked) {
      await updateDoc(msgRef, {
        likes: arrayRemove(userId),
      });
    } else {
      await updateDoc(msgRef, {
        likes: arrayUnion(userId),
      });
    }
  };

  // 发送评论
  const sendComment = async (msgId) => {
    const text = commentInputs[msgId]?.trim();
    if (!text) return;

    try {
      await addDoc(collection(db, "messages", msgId, "comments"), {
        userId,
        text,
        timestamp: serverTimestamp(),
      });
      setCommentInputs((prev) => ({ ...prev, [msgId]: "" }));
    } catch (error) {
      console.error("댓글 전송 실패:", error);
      alert("댓글 전송 중 오류가 발생했습니다.");
    }
  };

  // 下载聊天记录csv
  const downloadChat = () => {
    if (messages.length === 0) return;

    const maxComments = Math.max(
      ...messages.map((m) => commentsData[m.id]?.length || 0)
    );

    const header = ["시간", "사용자ID", "그룹번호", "메시지", "좋아요수", "댓글수"];
    for (let i = 1; i <= maxComments; i++) {
      header.push(`댓글${i}`);
    }

    const escapeCsv = (text) => {
      if (!text) return "";
      const str = text.toString();
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      header.join(","),
      ...messages.map((m) => {
        const time = m.timestamp
          ? new Date(
              m.timestamp.seconds
                ? m.timestamp.seconds * 1000
                : m.timestamp
            ).toLocaleString()
          : "";
        const commentList = commentsData[m.id] || [];
        const commentCount = commentList.length;
        const commentTexts = commentList.map((c) => `[${c.userId}] ${c.text}`);
        while (commentTexts.length < maxComments) {
          commentTexts.push("");
        }
        return [
          time,
          m.userId,
          m.groupNum,
          m.text,
          m.likes?.length || 0,
          commentCount,
          ...commentTexts,
        ]
          .map(escapeCsv)
          .join(",");
      }),
    ];

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "chat_history.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  // 删除聊天记录（密码验证）
  const clearChat = async () => {
    const pwd = prompt(
      "채팅 기록을 삭제하려면 비밀번호를 입력하세요.\n(주의: 삭제 후 복구 불가)"
    );
    if (pwd !== "perper222222") {
      alert("비밀번호가 틀렸습니다. 삭제를 취소합니다.");
      return;
    }

    if (!window.confirm("정말로 모든 채팅 기록을 삭제하시겠습니까?")) {
      return;
    }

    try {
      for (const msg of messages) {
        const commSnap = await getDocs(
          collection(db, "messages", msg.id, "comments")
        );
        const deleteComms = commSnap.docs.map((docSnap) =>
          deleteDoc(doc(db, "messages", msg.id, "comments", docSnap.id))
        );
        await Promise.all(deleteComms);
      }

      const snapshot = await getDocs(collection(db, "messages"));
      const deletePromises = snapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, "messages", docSnap.id))
      );
      await Promise.all(deletePromises);

      alert("모든 채팅 기록이 삭제되었습니다.");
    } catch (error) {
      console.error("삭제 중 오류 발생:", error);
      alert("채팅 기록 삭제 중 오류가 발생했습니다.");
    }
  };

  // 输入框数字限制
  const handleUserIdChange = (e) => {
    setUserId(e.target.value.replace(/\D/g, ""));
  };
  const handleGroupNumChange = (e) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val === "" || (Number(val) >= 1 && Number(val) <= 4)) {
      setGroupNum(val);
    }
  };

  if (!entered) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-gray-50">
        <p className="text-gray-600 mb-4 text-center max-w-md">
          이 플랫폼은 익명으로 운영되는 가상의 소셜 미디어 플랫폼입니다.<br />
          사용자 ID(숫자)와 그룹 번호(1~4)를 입력 후 채팅에 입장할 수 있습니다.<br />
          채팅에 입장한 후, 3분 30초 동안 생각을 작성한 후에야 다른 사람의 내용을 볼 수 있고 상호작용할 수 있습니다.<br />
          전체 체험 시간은 4분이며 시간이 종료되면 페이지가 자동 종료됩니다.
        </p>

        <label className="w-full max-w-md mb-4">
          <div className="mb-1 font-semibold">User ID (숫자)</div>
          <input
            type="text"
            placeholder="아이디를 입력하세요"
            value={userId}
            onChange={handleUserIdChange}
            className="border p-2 rounded w-full"
          />
        </label>

        <label className="w-full max-w-md mb-4">
          <div className="mb-1 font-semibold">Group Number (1~4)</div>
          <input
            type="text"
            placeholder="그룹 번호를 입력하세요"
            value={groupNum}
            onChange={handleGroupNumChange}
            maxLength={1}
            className="border p-2 rounded w-full"
          />
        </label>

        <button
          disabled={userId === "" || groupNum === ""}
          onClick={() => setEntered(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full max-w-md mt-4 disabled:opacity-50"
        >
          채팅 입장
        </button>
      </div>
    );
  }

  // 进入聊天区后，如果还没发过消息，只显示提示和输入框
  if (!hasPosted) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-gray-50">
        <p className="text-center text-gray-700 max-w-md mb-4">
          3분 30초 동안 생각을 작성한 후에야 다른 사람의 내용을 볼 수 있고 상호작용할 수 있습니다.<br />
          아래에 의견을 입력하고 전송해 주세요.
        </p>

        <div className="flex w-full max-w-md space-x-2 mb-4">
          <input
            type="text"
            placeholder="메시지를 입력하세요..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="border p-2 flex-grow rounded text-left"
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
          />
          <button
            onClick={sendMessage}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            전송
          </button>
        </div>

        <div className="text-red-600 font-semibold">
          남은 시간: {Math.floor(timeLeft / 60)}분 {timeLeft % 60}초
        </div>

        <button
          onClick={() => {
            if (
              window.confirm(
                "페이지를 종료하시겠습니까? (저장하지 않은 내용은 사라집니다.)"
              )
            ) {
              window.location.reload();
            }
          }}
          className="mt-6 bg-gray-300 px-4 py-2 rounded"
        >
          페이지 종료
        </button>
      </div>
    );
  }

  // hasPosted后显示全部聊天内容和互动区
  return (
    <div className="fixed top-0 left-0 w-full h-full flex flex-col bg-white">
      {/* 顶部按钮区 */}
      <div className="flex justify-between items-center p-4 border-b">
        <button
          onClick={downloadChat}
          className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-600"
        >
          다운로드
        </button>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            className="bg-red-400 text-white px-3 py-1 rounded hover:bg-red-500"
          >
            채팅 기록 삭제
          </button>
          <span className="text-sm text-red-500 select-none">클릭하지 마세요</span>
        </div>
      </div>

      {/* 剩余时间显示 */}
      <div className="p-2 text-right text-sm text-red-600 font-semibold">
        남은 시간: {Math.floor(timeLeft / 60)}분 {timeLeft % 60}초
      </div>

      {/* 聊天列表 */}
      <div
        className="flex-grow overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 && (
          <p className="text-center text-gray-400 mt-10 col-span-full">
            채팅 기록이 없습니다.
          </p>
        )}

        {messages.map((m) => {
          const hasLiked = m.likes?.includes(userId);

          return (
            <div
              key={m.id}
              className="border rounded p-3 flex flex-col bg-gray-50"
              style={{ wordBreak: "break-word" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mb-2 select-none"
                style={{ backgroundColor: getAvatarColor(m.userId) }}
                title={`User ${m.userId}`}
              >
                {m.userId}
              </div>

              <div className="text-xs text-gray-500 mb-1">
                그룹: {m.groupNum}
              </div>

              <div className="flex-grow mb-2">{m.text}</div>

              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <button
                  onClick={() => toggleLike(m)}
                  className={`px-2 py-1 rounded ${
                    hasLiked ? "bg-red-300 text-white" : "hover:bg-gray-200"
                  }`}
                >
                  ❤️ {m.likes?.length || 0}
                </button>

                <button
                  onClick={() =>
                    setOpenComments((prev) => ({
                      ...prev,
                      [m.id]: !prev[m.id],
                    }))
                  }
                  className="px-2 py-1 rounded hover:bg-gray-200"
                >
                  댓글 {commentsData[m.id]?.length || 0}
                </button>
              </div>

              {/* 评论区 */}
              {openComments[m.id] && (
                <div className="border-t pt-2">
                  {/* 评论列表 */}
                  {(commentsData[m.id] || []).map((c) => (
                    <div
                      key={c.id}
                      className="mb-1 text-sm border rounded p-1 bg-white"
                      style={{ wordBreak: "break-word" }}
                    >
                      <span className="font-semibold">{c.userId}: </span>
                      {c.text}
                    </div>
                  ))}

                  {/* 评论输入框 */}
                  <div className="flex space-x-2 mt-2">
                    <input
                      type="text"
                      value={commentInputs[m.id] || ""}
                      onChange={(e) =>
                        setCommentInputs((prev) => ({
                          ...prev,
                          [m.id]: e.target.value,
                        }))
                      }
                      placeholder="댓글 입력..."
                      className="flex-grow border p-1 rounded"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendComment(m.id);
                      }}
                    />
                    <button
                      onClick={() => sendComment(m.id)}
                      className="bg-green-400 px-3 rounded text-white"
                    >
                      전송
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
