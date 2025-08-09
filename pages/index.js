import { useState, useEffect } from "react";
import { collection, query, orderBy, addDoc, onSnapshot } from "firebase/firestore";
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
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

  if (!entered) {
    return (
      <div style={{ padding: 20 }}>
        <h3>익명 채팅방</h3>
        <input
          placeholder="아이디 입력"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          style={{ padding: 8, width: 200, marginBottom: 10 }}
        />
        <br />
        <button
          onClick={() => {
            if (!userId.trim()) alert("아이디를 입력하세요.");
            else setEntered(true);
          }}
          style={{ padding: "8px 16px" }}
        >
          입장하기
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "auto" }}>
      <div style={{ height: 400, overflowY: "auto", border: "1px solid #ccc", padding: 10 }}>
        {messages.length === 0 && <p>메시지가 없습니다.</p>}
        {messages.map(m => (
          <div key={m.id} style={{ marginBottom: 10, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            <div style={{ fontSize: 12, color: "#999" }}>
              {m.timestamp ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleString() : ""}
            </div>
            <div>
              <b>{m.userId}</b>: {m.text}
            </div>
          </div>
        ))}
      </div>
      <input
        placeholder="메시지 입력..."
        value={message}
        onChange={e => setMessage(e.target.value)}
        style={{ width: "100%", padding: 8, marginTop: 10, marginBottom: 10 }}
        onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
      />
      <button onClick={sendMessage} style={{ padding: "8px 16px" }}>
        보내기
      </button>
    </div>
  );
}
