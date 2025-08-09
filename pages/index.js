// pages/index.js
import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  addDoc,
  onSnapshot
} from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Home() {
  const [userId, setUserId] = useState("");
  const [entered, setEntered] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!entered) return;

    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [entered]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    await addDoc(collection(db, "messages"), {
      userId,
      text: message,
      timestamp: new Date()
    });
    setMessage("");
  };

  const downloadMessagesCSV = () => {
    const header = "시간,사용자ID,메시지\n";
    const rows = messages.map(m => {
      const time = m.timestamp
        ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleString()
        : "";
      const safeText = `"${(m.text || "").replace(/"/g, '""')}"`; // 处理引号
      return `"${time}","${m.userId}",${safeText}`;
    });
    const csvContent = header + rows.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "채팅기록.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  if (!entered) {
    return (
      <div className="flex flex-col justify-center items-center h-full space-y-4">
        <p className="text-gray-600">이 채팅방은 익명 채팅방입니다.</p>
        <input
          type="text"
          placeholder="숫자 ID를 입력하세요"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded w-64"
        />
        <button
          onClick={() => setEntered(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          채팅방 입장
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto p-4">
      {/* 聊天内容 */}
      <div className="border p-4 flex-1 overflow-y-auto bg-white rounded shadow">
        {messages.map((m) => (
          <div key={m.id} className="mb-4 border-b pb-2">
            <div className="text-xs text-gray-500">
              {m.timestamp
                ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleString()
                : ""}
            </div>
            <div>
              <strong>{m.userId}</strong>: {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* 输入框 & 按钮 */}
      <div className="flex space-x-2 mt-4">
        <input
          type="text"
          placeholder="메시지를 입력하세요..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="border p-2 flex-grow rounded"
        />
        <button
          onClick={sendMessage}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          보내기
        </button>
        <button
          onClick={downloadMessagesCSV}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          다운로드
        </button>
      </div>
    </div>
  );
}
