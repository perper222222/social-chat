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
  collectionGroup,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Home() {
  const [userId, setUserId] = useState("");
  const [entered, setEntered] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [commentInputs, setCommentInputs] = useState({}); // { msgId: commentText }
  const [openComments, setOpenComments] = useState({}); // { msgId: true/false }
  const [commentsData, setCommentsData] = useState({}); // { msgId: [comments] }

  // 监听消息列表
  useEffect(() => {
    if (!entered) return;

    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [entered]);

  // 监听所有已展开消息的评论
  useEffect(() => {
    if (!entered) return;

    // 订阅所有打开的消息评论
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

  // 发送消息
  const sendMessage = async () => {
    if (!message.trim()) return;

    await addDoc(collection(db, "messages"), {
      userId,
      text: message,
      timestamp: serverTimestamp(),
      likes: [],
    });
    setMessage("");
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

    await addDoc(collection(db, "messages", msgId, "comments"), {
      userId,
      text,
      timestamp: serverTimestamp(),
    });

    setCommentInputs((prev) => ({ ...prev, [msgId]: "" }));
  };

  // 下载聊天记录CSV（只包括主消息）
  const downloadChat = () => {
    if (messages.length === 0) return;

    const header = ['시간', '사용자ID', '메시지', '좋아요수'];

    const escapeCsv = (text) => {
      if (!text) return "";
      const str = text.toString();
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      header.join(','),
      ...messages.map((m) => {
        const time = m.timestamp
          ? new Date(
              m.timestamp.seconds
                ? m.timestamp.seconds * 1000
                : m.timestamp
            ).toLocaleString()
          : "";
        return [time, m.userId, m.text, m.likes?.length || 0].map(escapeCsv).join(',');
      }),
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat_history.csv';
    a.click();

    URL.revokeObjectURL(url);
  };

  // 删除聊天记录
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
      // 先删除所有评论子集合里的文档（简化起见不深度递归）
      for (const msg of messages) {
        const commSnap = await getDocs(collection(db, "messages", msg.id, "comments"));
        const deleteComms = commSnap.docs.map((docSnap) =>
          deleteDoc(doc(db, "messages", msg.id, "comments", docSnap.id))
        );
        await Promise.all(deleteComms);
      }

      // 删除所有主消息
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

  if (!entered) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-gray-50">
        <p className="text-gray-600 mb-2">이 채팅방은 익명 채팅방입니다.</p>
        <input
          type="text"
          placeholder="숫자 신분 ID를 입력하세요"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded w-full max-w-md"
        />
        <button
          onClick={() => setEntered(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full max-w-md mt-4"
        >
          채팅 입장
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 w-full h-full flex flex-col bg-white border shadow-lg">
      <div className="flex justify-between items-center p-4 border-b">
        <button
          onClick={downloadChat}
          className="bg-gray-700 text-white px-4 py-1 rounded hover:bg-gray-800"
        >
          다운로드
        </button>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            채팅 기록 삭제
          </button>
          <span className="text-sm text-red-500 select-none">클릭하지 마세요</span>
        </div>
      </div>

      <div
        className="flex-grow overflow-y-auto p-4"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 && (
          <p className="text-center text-gray-400 mt-10">채팅 기록이 없습니다.</p>
        )}

        {messages.map((m) => {
          const isOwnMessage = m.userId === userId;
          const hasLiked = m.likes?.includes(userId);

          return (
            <div
              key={m.id}
              className={`flex mb-4 ${isOwnMessage ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-lg break-words whitespace-pre-wrap
                  ${
                    isOwnMessage
                      ? "bg-green-500 text-white rounded-br-none"
                      : "bg-gray-300 text-gray-900 rounded-bl-none"
                  }`}
              >
                <div className="text-xs opacity-70 mb-1">{m.userId}</div>
                <div>{m.text}</div>
                <div className="text-xs opacity-50 mt-1 text-right">
                  {m.timestamp
                    ? new Date(
                        m.timestamp.seconds
                          ? m.timestamp.seconds * 1000
                          : m.timestamp
                      ).toLocaleTimeString()
                    : ""}
                </div>

                {/* 点赞按钮 */}
                <div className="flex items-center space-x-1 mt-2 cursor-pointer select-none">
                  <button
                    onClick={() => toggleLike(m)}
                    className={`text-sm ${
                      hasLiked ? "text-red-500" : "text-gray-400"
                    }`}
                    aria-label="좋아요 토글"
                  >
                    ❤️
                  </button>
                  <span className="text-xs text-gray-600">{m.likes?.length || 0}</span>
                </div>

                {/* 评论展开按钮 */}
                <button
                  onClick={() =>
                    setOpenComments((prev) => ({
                      ...prev,
                      [m.id]: !prev[m.id],
                    }))
                  }
                  className="mt-2 text-xs text-blue-600 hover:underline focus:outline-none"
                >
                  {openComments[m.id] ? "댓글 숨기기" : "댓글 보기"}
                </button>

                {/* 评论区 */}
                {openComments[m.id] && (
                  <div className="mt-2 border-t border-gray-400 pt-2 max-h-48 overflow-y-auto text-left">
                    {(commentsData[m.id]?.length ?? 0) === 0 && (
                      <p className="text-gray-500 text-xs italic">댓글이 없습니다.</p>
                    )}

                    {commentsData[m.id]?.map((c) => (
                      <div key={c.id} className="mb-1">
                        <div className="text-xs font-semibold">{c.userId}</div>
                        <div className="text-sm">{c.text}</div>
                        <div className="text-xs opacity-50 text-right">
                          {c.timestamp
                            ? new Date(
                                c.timestamp.seconds
                                  ? c.timestamp.seconds * 1000
                                  : c.timestamp
                              ).toLocaleTimeString()
                            : ""}
                        </div>
                      </div>
                    ))}

                    {/* 评论输入 */}
                    <div className="flex space-x-2 mt-1">
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
                        className="border p-1 flex-grow rounded"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") sendComment(m.id);
                        }}
                      />
                      <button
                        onClick={() => sendComment(m.id)}
                        className="bg-blue-600 text-white px-3 rounded"
                      >
                        전송
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
