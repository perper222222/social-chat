import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function TestFirebase() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(data);
    });
    return () => unsubscribe();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    await addDoc(collection(db, "messages"), {
      userId: "testUser",
      text: input,
      timestamp: new Date()
    });
    setInput("");
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "auto" }}>
      <h2>Firebase 기능 테스트</h2>
      <div style={{ height: 300, overflowY: "auto", border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
        {messages.length === 0 && <p>메시지가 없습니다.</p>}
        {messages.map(msg => (
          <div key={msg.id}>
            <b>{msg.userId}</b>: {msg.text} <br />
            <small>{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleString() : new Date(msg.timestamp.seconds * 1000).toLocaleString()}</small>
            <hr />
          </div>
        ))}
      </div>
      <input
        style={{ width: "100%", padding: 8, marginBottom: 10 }}
        placeholder="메시지 입력"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && sendMessage()}
      />
      <button onClick={sendMessage} style={{ padding: "8px 16px" }}>보내기</button>
    </div>
  );
}
