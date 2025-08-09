import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  addDoc,
  onSnapshot,
  getDocs,
  deleteDoc,
  doc,
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
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
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
      timestamp: new Date(),
    });
    setMessage("");
  };

  // CSV格式下载函数
  const downloadChat = () => {
    if (messages.length === 0) return;

    // CSV头部
    const header = ["시간", "사용자ID", "메시지"].join(",") + "\n";

    // CSV正文，注意内容如果有逗号或换行，使用双引号包裹，并且双引号要转义成双双引号
    const rows = messages.map((m) => {
      const time = m.timestamp
        ? new Date(
            m.timestamp.seconds
              ? m.timestamp.seconds * 1000
              : m.timestamp
          ).toLocaleString()
        : "";
      const user = m.userId.replace(/"/g, '""');
      const text = m.text.replace(/"/g, '""');
      return `"${time}","${user}","${text}"`;
    });

    const csvContent = header + rows.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "chat_history.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  const clearChat = async () => {
    const pwd = prompt(
      "채팅 기록을 삭제하려면 비밀번호를 입력하세요.\n(주의: 삭제 후 복구 불가)"
    );
    if (pwd !== "perper222222") {
      alert("비밀번호가 틀렸습니다. 삭제를 취소합니다.");
      return;
    }

    if (!window.confirm("정말로 모든 채팅 기록을 삭제하시겠습니까?")) {
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, "messages"));
      const deletePromises = snapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, "messages", docSnap.id))
      );
      await Promise.all(deletePromises);
      alert("모든 채팅 기록이 삭제되었습니다.");
    } catch (error) {
      console.error("삭제 중 오류 발생:", error);
      alert("채팅 기록 삭제 중 오류가 발생했습니다.");
    }
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
    <div
      className="flex flex-col fixed bottom-10 left-0 right-0 mx-auto space-y-4 px-4 bg-white border rounded shadow-lg"
      style={{
        maxHeight: "80vh",
        width: "100%",
        maxWidth: "100%",
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      {/* 下载 & 清除按钮 */}
      <div className="flex justify-between items-center mb-2 max-w-screen-lg mx-auto">
        <button
          onClick={downloadChat}
          className="bg-gray-700 text-white px-4 py-1 rounded hover:bg-gray-800"
        >
          다운로드
        </button>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            채팅 기록 삭제
          </button>
          <span className="text-sm text-red-500 select-none">
            클릭하지 마세요
          </span>
        </div>
      </div>

      {/* 聊天框 */}
      <div
        className="border p-4 overflow-y-auto flex-grow max-w-screen-lg mx-auto"
        style={{ minHeight: "300px", maxHeight: "calc(80vh - 120px)" }}
      >
        {messages.length === 0 && (
          <p className="text-center text-gray-400 mt-10">채팅 기록이 없습니다.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="mb-4 border-b pb-2">
            <div className="text-xs text-gray-500">
              {m.timestamp
                ? new Date(
                    m.timestamp.seconds
                      ? m.timestamp.seconds * 1000
                      : m.timestamp
                  ).toLocaleString()
                : ""}
            </div>
            <div>
              <strong>{m.userId}</strong>: {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* 输入框和发送按钮 */}
      <div className="flex space-x-2 max-w-screen-lg mx-auto">
        <input
          type="text"
          placeholder="메시지를 입력하세요..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="border p-2 rounded flex-grow max-w-[600px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
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
