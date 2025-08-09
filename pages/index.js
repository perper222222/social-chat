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
      timestamp: new Date() // 로컬 시간 우선 사용
    });
    setMessage("");
  };

  // 채팅 내용 다운로드 함수
  const downloadChat = () => {
    if (messages.length === 0) return;

    const chatText = messages
      .map(m => {
        const time = m.timestamp
          ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleString()
          : "";
        return `[${time}] ${m.userId}: ${m.text}`;
      })
      .join("\n");

    const blob = new Blob([chatText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "chat_history.txt";
    a.click();

    URL.revokeObjectURL(url);
  };

  if (!entered) {
    return (
      <div className="flex flex-col items-center mt-20 space-y-4 max-w-md mx-auto px-4">
        <p className="text-gray-600 mb-2">이 채팅방은 익명 채팅방입니다.</p>
        <input
          type="text"
          placeholder="숫자 신분 ID를 입력하세요"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <button
          onClick={() => setEntered(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full"
        >
          채팅 입장
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full mt-10 space-y-4 px-4">
      {/* 下载按钮 */}
      <div className="flex justify-end mb-2">
        <button
          onClick={downloadChat}
          className="bg-gray-700 text-white px-4 py-1 rounded hover:bg-gray-800"
        >
          다운로드
        </button>
      </div>

      {/* 聊天框 */}
      <div className="border p-4 h-96 overflow-y-auto bg-white w-full">
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

      {/* 输入框和发送按钮 */}
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
          전송
        </button>
      </div>
    </div>
  );
}
