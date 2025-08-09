import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  where,
  addDoc,
  onSnapshot,
  getDocs
} from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Home() {
  const [userId, setUserId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [entered, setEntered] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // 实时监听同场次消息
  useEffect(() => {
    if (!entered) return;

    const q = query(
      collection(db, "messages"),
      where("sessionId", "==", sessionId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [entered, sessionId]);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    const msgToSend = message.trim();
    setMessage(""); // 先清空输入框，避免异步问题
    try {
      await addDoc(collection(db, "messages"), {
        userId,
        sessionId,
        text: msgToSend,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("메시지 전송 실패:", error);
      setMessage(msgToSend); // 发送失败时恢复文本
    }
  };

  // 支持回车发送，Shift+Enter换行
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 导出 CSV
  const exportMessages = async () => {
    const q = query(
      collection(db, "messages"),
      where("sessionId", "==", sessionId),
      orderBy("timestamp", "asc")
    );
    const snapshot = await getDocs(q);
    const allMsgs = snapshot.docs.map(doc => doc.data());

    const csvHeader = "userId,sessionId,text,timestamp\n";
    const csvRows = allMsgs.map(m =>
      `${m.userId || ""},${m.sessionId || ""},"${m.text || ""}",${m.timestamp?.toISOString ? m.timestamp.toISOString() : new Date(m.timestamp).toISOString()}`
    );
    const csvContent = csvHeader + csvRows.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "messages.csv");
    link.click();
  };

  if (!entered) {
    return (
      <div className="flex flex-col items-center mt-20 space-y-4 max-w-sm mx-auto">
        <input
          type="text"
          placeholder="사용자 ID 입력"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <input
          type="text"
          placeholder="세션 ID 입력 (필수)"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <button
          onClick={() => {
            if (userId.trim() && sessionId.trim()) setEntered(true);
            else alert("사용자 ID와 세션 ID 모두 입력해주세요.");
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          입장하기
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
                ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleString("ko-KR")
                : "전송 중..."}
            </div>
            <div>
              <strong>{m.userId}</strong>: {m.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <textarea
        rows={2}
        placeholder="메시지를 입력하세요..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        className="border p-2 rounded resize-none"
      />

      <div className="flex space-x-2">
        <button
          onClick={sendMessage}
          className="bg-green-600 text-white px-4 py-2 rounded flex-grow"
        >
          전송
        </button>
        <button
          onClick={exportMessages}
          className="bg-gray-600 text-white px-4 py-2 rounded"
        >
          대화 내역 다운로드
        </button>
      </div>
    </div>
  );
}
