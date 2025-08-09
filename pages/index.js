import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  where,
  addDoc,
  serverTimestamp,
  onSnapshot,
  getDocs
} from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Home() {
  const [userId, setUserId] = useState("");
  const [batchId, setBatchId] = useState(""); // 如果不需要批次隔离，可以不填
  const [entered, setEntered] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!entered) return;

    let q;
    if (batchId) {
      q = query(
        collection(db, "messages"),
        where("batchId", "==", batchId),
        orderBy("timestamp", "asc")
      );
    } else {
      q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data());
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [entered, batchId]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    await addDoc(collection(db, "messages"), {
      userId,
      batchId: batchId || null,
      text: message,
      timestamp: serverTimestamp()
    });
    setMessage("");
  };

  const exportMessages = async () => {
    let q;
    if (batchId) {
      q = query(
        collection(db, "messages"),
        where("batchId", "==", batchId),
        orderBy("timestamp", "asc")
      );
    } else {
      q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    }

    const snapshot = await getDocs(q);
    const allMsgs = snapshot.docs.map(doc => doc.data());

    const csvHeader = "userId,batchId,text,timestamp\n";
    const csvRows = allMsgs.map(m =>
      `${m.userId || ""},${m.batchId || ""},"${m.text || ""}",${m.timestamp?.toDate().toISOString() || ""}`
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
      <div className="flex flex-col items-center mt-20 space-y-4">
        <input
          type="text"
          placeholder="ID 입력해 주세요"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="세션 번호 입역해 주세요"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          className="border p-2 rounded"
        />
        <button
          onClick={() => setEntered(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          채팅시작
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-lg mx-auto mt-10 space-y-4">
      <div className="border p-4 h-96 overflow-y-auto">
        {messages.map((m, idx) => (
          <div key={idx} className="mb-2">
            <strong>{m.userId}</strong>: {m.text}
          </div>
        ))}
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="내용 입력"
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
      <button
        onClick={exportMessages}
        className="bg-gray-500 text-white px-4 py-2 rounded"
      >
        데이터 다우로드
      </button>
    </div>
  );
}
