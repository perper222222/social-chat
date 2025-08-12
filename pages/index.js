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
  const [entered, setEntered] = useState(false);
  const [posted, setPosted] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentsData, setCommentsData] = useState({});
  const [timeLeft, setTimeLeft] = useState(240); // 4分钟 = 240秒

  // 进入后开始倒计时
  useEffect(() => {
    if (!entered) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          alert("시간이 종료되었습니다. 다시 입장하세요.");
          setEntered(false);
          setPosted(false);
          setUserId("");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [entered]);

  // 只有 posted 后才加载别人的帖子
  useEffect(() => {
    if (!posted) return;
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [posted]);

  useEffect(() => {
    if (!posted) return;
    setOpenComments(messages.reduce((acc, msg) => {
      acc[msg.id] = true;
      return acc;
    }, {}));
  }, [messages, posted]);

  useEffect(() => {
    if (!posted) return;
    const unsubscribes = Object.entries(openComments)
      .filter(([, isOpen]) => isOpen)
      .map(([msgId]) => {
        const q = query(collection(db, "messages", msgId, "comments"), orderBy("timestamp", "asc"));
        return onSnapshot(q, (snapshot) => {
          const comms = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setCommentsData((prev) => ({ ...prev, [msgId]: comms }));
        });
      });
    return () => unsubscribes.forEach((unsub) => unsub());
  }, [openComments, posted]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    await addDoc(collection(db, "messages"), {
      userId,
      text: message,
      timestamp: serverTimestamp(),
      likes: [],
    });
    setMessage("");
    if (!posted) setPosted(true); // 第一次发帖后才看到别人的内容
  };

  const toggleLike = async (msg) => {
    const msgRef = doc(db, "messages", msg.id);
    const hasLiked = msg.likes?.includes(userId);
    await updateDoc(msgRef, {
      likes: hasLiked ? arrayRemove(userId) : arrayUnion(userId),
    });
  };

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

  if (!entered) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-gray-50">
        <p className="text-gray-600 mb-2 text-center">
          이 플랫폼은 익명으로 운영되는 가상의 소셜 미디어 플랫폼입니다.<br />
          사용자 ID(숫자)를 입력하시면 체험을 시작할 수 있습니다.
        </p>
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
          입장
        </button>
      </div>
    );
  }

  if (entered && !posted) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-white">
        <div className="text-red-500 font-bold mb-4">
          남은 시간: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
        </div>
        <p className="text-gray-700 mb-4 text-center">
          아이디어를 입력하고 게시를 클릭해야<br />
          다른 사람의 글과 상호작용할 수 있습니다.<br />
          이 과정은 총 3분 30초 동안 진행됩니다.
        </p>
        <div className="flex space-x-2 w-full max-w-md">
          <input
            type="text"
            placeholder="메시지를 입력하세요..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="border p-2 flex-grow rounded"
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
          />
          <button
            onClick={sendMessage}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            게시
          </button>
        </div>
      </div>
    );
  }

  // posted == true 的聊天界面
  return (
    <div className="fixed top-0 left-0 w-full h-full flex flex-col bg-white">
      <div className="flex justify-between items-center p-4 border-b">
        <div className="text-red-500 font-bold">
          남은 시간: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {messages.map((m) => {
          const hasLiked = m.likes?.includes(userId);
          return (
            <div key={m.id} className="bg-gray-50 border rounded-lg p-4 flex flex-col shadow-sm">
              <div className="flex items-center mb-3">
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-full text-white font-bold"
                  style={{ backgroundColor: getAvatarColor(m.userId) }}
                >
                  {m.userId}
                </div>
                <span className="ml-3 font-semibold">{m.userId}</span>
              </div>
              <div className="text-gray-800 whitespace-pre-wrap mb-3">{m.text}</div>
              <div className="flex items-center space-x-2 mb-3">
                <button onClick={() => toggleLike(m)} className={`text-xl ${hasLiked ? "text-red-500" : "text-gray-400"}`}>❤️</button>
                <span>{m.likes?.length || 0}</span>
              </div>
              <div className="border-t pt-2 mt-auto">
                {commentsData[m.id]?.map((c) => (
                  <div key={c.id} className="mb-1">
                    <span className="font-semibold text-xs">{c.userId}</span>
                    <p className="text-sm">{c.text}</p>
                  </div>
                ))}
                <div className="flex space-x-2 mt-2">
                  <input
                    type="text"
                    placeholder="댓글을 입력하세요..."
                    value={commentInputs[m.id] || ""}
                    onChange={(e) => setCommentInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className="border p-1 flex-grow rounded text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") sendComment(m.id); }}
                  />
                  <button onClick={() => sendComment(m.id)} className="bg-blue-500 text-white px-3 rounded text-sm">전송</button>
                </div>
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
          className="border p-2 flex-grow rounded"
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
        />
        <button onClick={sendMessage} className="bg-green-500 text-white px-4 py-2 rounded">전송</button>
      </div>
    </div>
  );
}
