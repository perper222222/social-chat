"use client";

import { useState, useEffect } from "react";
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
  const [userId, setUserId] = useState("");
  const [groupNumber, setGroupNumber] = useState("");
  const [opinion, setOpinion] = useState("");
  const [entered, setEntered] = useState(false);
  const [opinionPosted, setOpinionPosted] = useState(false); // 是否发布了入场意见

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentsData, setCommentsData] = useState({});

  const [countdown, setCountdown] = useState(240);

  const isUserIdValid = /^\d+$/.test(userId);
  const isGroupNumberValid = /^[1-4]$/.test(groupNumber);
  const isOpinionValid = opinion.trim().length > 0;

  // 进入聊天室，先发入场意见，再进入
  const enterChat = async () => {
    if (!(isUserIdValid && isGroupNumberValid && isOpinionValid)) return;

    try {
      await addDoc(collection(db, "messages"), {
        userId,
        groupNumber,
        opinion,
        text: `처음 의견: ${opinion}`, // 可根据需要改
        timestamp: serverTimestamp(),
        likes: [],
      });
      setOpinionPosted(true);
      setEntered(true);
    } catch (error) {
      console.error("의견 저장 실패:", error);
      alert("의견 저장 중 오류가 발생했습니다.");
    }
  };

  // 监听消息，只有进入后监听
  useEffect(() => {
    if (!entered) return;

    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [entered]);

  // 默认展开所有评论
  useEffect(() => {
    if (!entered) return;
    setOpenComments(
      messages.reduce((acc, msg) => {
        acc[msg.id] = true;
        return acc;
      }, {})
    );
  }, [messages, entered]);

  // 监听评论
  useEffect(() => {
    if (!entered) return;

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
  }, [openComments, entered]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    await addDoc(collection(db, "messages"), {
      userId,
      groupNumber,
      opinion,
      text: message,
      timestamp: serverTimestamp(),
      likes: [],
    });
    setMessage("");
  };

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

  const downloadChat = () => {
    if (messages.length === 0) return;

    const maxComments = Math.max(
      ...messages.map((m) => commentsData[m.id]?.length || 0)
    );

    const header = ["시간", "사용자ID", "그룹번호", "의견", "메시지", "좋아요수", "댓글수"];

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
          m.groupNumber || "",
          m.opinion || "",
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

  // 倒计时
  useEffect(() => {
    if (!entered) return;

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [entered]);

  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!entered) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-gray-50">
        <p className="text-gray-600 mb-4 text-center leading-relaxed">
          이 플랫폼은 익명으로 운영되는 가상의 소셜 미디어 플랫폼입니다.<br />
          사용자 ID(숫자)와 그룹 번호(1~4)를 입력하시고,<br />
          아래 큰 텍스트 박스에 질문에 대한 의견을 작성해주세요.<br />
          모두 입력 후 채팅 입장 버튼을 누르면 다른 사람들의 의견도 보고 소통할 수 있습니다.
        </p>

        <div className="flex items-center mb-3 w-full max-w-md">
          <label className="w-24 text-right mr-2 text-sm font-medium">ID (숫자):</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            placeholder="숫자만 입력"
            value={userId}
            onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))}
            className="border p-2 rounded flex-grow"
          />
        </div>

        <div className="flex items-center mb-3 w-full max-w-md">
          <label className="w-24 text-right mr-2 text-sm font-medium">Group Number (1~4):</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={1}
            placeholder="1~4 숫자 입력"
            value={groupNumber}
            onChange={(e) => {
              const val = e.target.value;
              if (/^[1-4]?$/.test(val)) {
                setGroupNumber(val);
              }
            }}
            className="border p-2 rounded flex-grow"
          />
        </div>

        <div className="w-full max-w-md mb-4">
          <label className="block mb-1 font-medium">이 문제에 대한 의견을 입력하세요 (필수)</label>
          <textarea
            rows={5}
            placeholder="여기에 의견을 입력하세요..."
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            className="border p-2 rounded w-full resize-none"
          />
        </div>

        <button
          disabled={!(isUserIdValid && isGroupNumberValid && isOpinionValid)}
          onClick={enterChat}
          className={`w-full max-w-md px-4 py-2 rounded text-white ${
            isUserIdValid && isGroupNumberValid && isOpinionValid
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          채팅 입장
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 w-full h-full flex flex-col bg-white">
      {/* 右上角倒计时 */}
      <div className="fixed top-2 right-4 bg-gray-800 text-white px-3 py-1 rounded font-mono text-sm z-50 select-none">
        남은 시간: {formatCountdown(countdown)}
      </div>

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

      {/* 帖子卡片布局 */}
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
              className="bg-gray-50 border rounded-lg p-4 flex flex-col shadow-sm"
            >
              {/* 用户头像 + ID + group + opinion */}
              <div className="flex items-center mb-3 space-x-3">
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-full text-white font-bold"
                  style={{ backgroundColor: getAvatarColor(m.userId) }}
                >
                  {m.userId}
                </div>
                <div>
                  <div className="font-semibold">{m.userId}</div>
                  <div className="text-xs text-gray-500">그룹: {m.groupNumber || "-"}</div>
                </div>
              </div>

              {/* 意见 */}
              <div className="text-sm font-medium mb-2 whitespace-pre-wrap border-l-4 border-blue-400 pl-2 text-blue-700">
                {m.opinion || "-"}
              </div>

              {/* 帖子内容 */}
              <div className="text-gray-800 whitespace-pre-wrap mb-3">{m.text}</div>

              {/* 时间 */}
              <div className="text-xs text-gray-500 mb-3">
                {m.timestamp
                  ? new Date(
                      m.timestamp.seconds
                        ? m.timestamp.seconds * 1000
                        : m.timestamp
                    ).toLocaleTimeString()
                  : ""}
              </div>

              {/* 点赞 */}
              <div className="flex items-center space-x-2 mb-3">
                <button
                  onClick={() => toggleLike(m)}
                  className={`text-xl ${
                    hasLiked ? "text-red-500" : "text-gray-400"
                  }`}
                >
                  ❤️
                </button>
                <span className="text-sm">{m.likes?.length || 0}</span>
              </div>

              {/* 评论区 */}
              <div className="border-t pt-2 mt-auto">
                {commentsData[m.id]?.map((c) => (
                  <div key={c.id} className="mb-1">
                    <span className="font-semibold text-xs">{c.userId}</span>
                    <p className="text-sm">{c.text}</p>
                  </div>
                ))}

                {/* 评论输入框 */}
                <div className="flex space-x-2 mt-2">
                  <input
                    type="text"
                    placeholder="댓글을 입력하세요..."
                    value={commentInputs[m.id] || ""}
                    onChange={(e) =>
                      setCommentInputs((prev) => ({
                        ...prev,
                        [m.id]: e.target.value,
                      }))
                    }
                    className="border p-1 flex-grow rounded text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendComment(m.id);
                    }}
                  />
                  <button
                    onClick={() => sendComment(m.id)}
                    className="bg-blue-500 text-white px-3 rounded text-sm"
                  >
                    전송
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部发帖区 */}
      <div className="flex space-x-2 p-4 border-t">
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
    </div>
  );
}
