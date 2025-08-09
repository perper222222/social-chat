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
  const [batchId, setBatchId] = useState(""); 
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
      const msgs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
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
          placeholder="输入你的数字身份 ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="可选：批次 ID"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
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
              {m.timestamp?.toDate
                ? m.timestamp.toDate().toLocaleString()
                : "发送中..."}
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
      <button
        onClick={exportMessages}
        className="bg-gray-500 text-white px-4 py-2 rounded"
      >
        导出消息 CSV
      </button>
    </div>
  );
}
