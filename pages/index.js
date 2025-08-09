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
      timestamp: new Date() // 로컬 시간 사용
    });
    setMessage("");
  };

  // CSV 내보내기 (클라이언트 환경에서만 실행)
  const exportToCSV = () => {
    if (typeof window === "undefined") return; // SSR 방지
    if (messages.length === 0) return;

    const headers = ["ID", "사용자ID", "메시지", "시간"];
    const rows = messages.map(m => [
      m.id,
      m.userId,
      m.text,
      m.timestamp
        ? new Date(
            m.timestamp.seconds
              ? m.timestamp.seconds * 1000
              : m.timestamp
          ).toLocaleString()
        : ""
    ]);

    let csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "chat_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!entered) {
    return (
      <div className="flex flex-col items-center mt-20 space-y-4">
        <input
          type="text"
          placeholder="당신의 ID를 입력하세요"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded"
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
    <div className="flex flex-col max-w-lg mx-auto mt-10 space-y-4">
      <div className="border p-4 h-96 overflow-y-auto">
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
      <div className="flex space-x-2">
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
          onClick={exportToCSV}
          className="bg-yellow-500 text-white px-4 py-2 rounded"
        >
          내보내기
        </button>
      </div>
    </div>
  );
}
