import { useState, useEffect } from "react";
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
  const [sessionId, setSessionId] = useState(""); // 세션 입력
  const [entered, setEntered] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // 실시간 메시지 구독 (같은 세션 필터링)
  useEffect(() => {
    if (!entered) return;
    if (!sessionId.trim()) return;

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
    });

    return () => unsubscribe();
  }, [entered, sessionId]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    await addDoc(collection(db, "messages"), {
      userId,
      sessionId,
      text: message,
      timestamp: new Date()
    });
    setMessage("");
  };

  // CSV 다운로드 (현재 세션 메시지)
  const exportMessages = async () => {
    if (!sessionId.trim()) {
      alert("세션 ID를 입력하세요.");
      return;
    }
    const q = query(
      collection(db, "messages"),
      where("sessionId", "==", sessionId),
      orderBy("timestamp", "asc")
    );
    const snapshot = await getDocs(q);
    const allMsgs = snapshot.docs.map(doc => doc.data());

    const csvHeader = "userId,sessionId,text,timestamp\n";
    const csvRows = allMsgs.map(m =>
      `${m.userId || ""},${m.sessionId || ""},"${m.text || ""}",${m.timestamp ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleString() : ""}`
    );
    const csvContent = csvHeader + csvRows.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = `messages_${sessionId}_${new Date().toISOString()}.csv`;
    link.setAttribute("download", fileName);
    link.click();
  };

  if (!entered) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4 px-4 max-w-sm mx-auto">
        <div className="text-gray-600 mb-2">이 채팅방은 익명 채팅방입니다</div>
        <input
          type="text"
          placeholder="아이디 입력"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <input
          type="text"
          placeholder="세션 입력"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <button
          onClick={() => {
            if (!userId.trim()) {
              alert("아이디를 입력하세요.");
              return;
            }
            if (!sessionId.trim()) {
              alert("세션을 입력하세요.");
              return;
            }
            setEntered(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          채팅 참여
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex-1 border rounded p-4 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            메시지가 없습니다.
          </div>
        )}
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
          placeholder="메시지 입력..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="border p-2 flex-grow rounded"
          onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
        />
        <button
          onClick={sendMessage}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          보내기
        </button>
      </div>

      <button
        onClick={exportMessages}
        className="bg-gray-600 text-white px-4 py-2 rounded"
      >
        데이터 다운로드 (CSV)
      </button>
    </div>
  );
}
