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
      timestamp: new Date() // 用本地时间先显示
    });
    setMessage("");
  };

  if (!entered) {
    return (
      <div className="flex flex-col items-center mt-20 space-y-4">
        <input
          type="text"
          placeholder="输入你的数字身份 ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded"
        />
        <button
          onClick={() => setEntered(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          进入聊天
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
          placeholder="输入消息..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="border p-2 flex-grow rounded"
        />
        <button
          onClick={sendMessage}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          发送
        </button>
      </div>
    </div>
  );
}
