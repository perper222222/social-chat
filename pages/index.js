import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  where,
  addDoc,
  onSnapshot
} from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Home() {
  const [userId, setUserId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [entered, setEntered] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

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

  if (!entered) {
    return (
      <div style={{ padding: 20, maxWidth: 400, margin: "auto", marginTop: 50 }}>
        <h2>익명 채팅방</h2>
        <p style={{ color: "#555", marginBottom: 10 }}>
          이 채팅방은 익명 채팅방입니다.
        </p>
        <input
          placeholder="아이디 입력"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 10 }}
        />
        <input
          placeholder="세션 입력"
          value={sessionId}
          onChange={e => setSessionId(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 20 }}
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
          style={{ width: "100%", padding: 10, backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: 4 }}
        >
          채팅 참여
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20, height: "90vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flexGrow: 1, overflowY: "auto", border: "1px solid #ddd", padding: 10, borderRadius: 4 }}>
        {messages.length === 0 && <p style={{ color: "#999", textAlign: "center", marginTop: 20 }}>메시지가 없습니다.</p>}
        {messages.map(m => (
          <div key={m.id} style={{ marginBottom: 15, borderBottom: "1px solid #eee", paddingBottom: 8 }}>
            <div style={{ fontSize: 12, color: "#888" }}>
              {m.timestamp ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleString() : ""}
            </div>
            <div><strong>{m.userId}</strong>: {m.text}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, display: "flex" }}>
        <input
          placeholder="메시지 입력..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
          style={{ flexGrow: 1, padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
        />
        <button
          onClick={sendMessage}
          style={{ marginLeft: 10, padding: "8px 16px", backgroundColor: "#16a34a", color: "white", border: "none", borderRadius: 4 }}
        >
          보내기
        </button>
      </div>
    </div>
  );
}
