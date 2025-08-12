"use client";

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
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

// 头像颜色列表
const avatarColors = [
  "#FF6B6B", "#6BCB77", "#4D96FF", "#FFD93D", "#C77DFF",
  "#FF8E72", "#4ADEDE", "#FF9F1C", "#2EC4B6", "#E71D36"
];

const getAvatarColor = (userId) => {
  if (!userId) return avatarColors[0];
  const index = parseInt(userId, 10) % avatarColors.length;
  return avatarColors[index];
};

export default function Home() {
  const [userId, setUserId] = useState("");
  const [groupId, setGroupId] = useState("1");
  const [entered, setEntered] = useState(false);
  const [hasPosted, setHasPosted] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});
  const [commentsData, setCommentsData] = useState({});
  const [countdown, setCountdown] = useState(240); // 4分钟倒计时（秒）

  // 倒计时
  useEffect(() => {
    if (!entered) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          alert("시간이 종료되었습니다. 페이지를 종료합니다.");
          window.close(); // 如果浏览器阻止关闭，可改成 window.location.href = "/"
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [entered]);

  // 加载别人的帖子（仅当 hasPosted = true 时）
  useEffect(() => {
    if (!entered || !hasPosted) return;
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [entered, hasPosted]);

  // 加载评论
  useEffect(() => {
    if (!entered || !hasPosted) return;
    messages.forEach((m) => {
      const q = query(collection(db, "messages", m.id, "comments"), orderBy("timestamp", "asc"));
      onSnapshot(q, (snapshot) => {
        const comms = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCommentsData((prev) => ({ ...prev, [m.id]: comms }));
      });
    });
  }, [messages, entered, hasPosted]);

  // 发送帖子
  const sendMessage = async () => {
    if (!message.trim()) return;
    await addDoc(collection(db, "messages"), {
      userId,
      groupId,
      text: message,
      timestamp: serverTimestamp(),
      likes: [],
    });
    setMessage("");
    if (!hasPosted) setHasPosted(true);
  };

  // 点赞
  const toggleLike = async (msg) => {
    const msgRef = doc(db, "messages", msg.id);
    const hasLiked = msg.likes?.includes(userId);
    if (hasLiked) {
      await updateDoc(msgRef, { likes: arrayRemove(userId) });
    } else {
      await updateDoc(msgRef, { likes: arrayUnion(userId) });
    }
  };

  // 发送评论
  const sendComment = async (msgId) => {
    const text = commentInputs[msgId]?.trim();
    if (!text) return;
    await addDoc(collection(db, "messages", msgId, "comments"), {
      userId,
      text,
      timestamp: serverTimestamp(),
    });
    setCommentInputs((prev) => ({ ...prev, [msgId]: "" }));
  };

  // 下载 CSV
  const downloadChat = () => {
    if (messages.length === 0) return;
    const maxComments = Math.max(...messages.map((m) => commentsData[m.id]?.length || 0));
    const header = ["시간", "사용자ID", "Group", "메시지", "좋아요수", "댓글수"];
    for (let i = 1; i <= maxComments; i++) header.push(`댓글${i}`);

    const escapeCsv = (text) => {
      if (!text) return "";
      const str = text.toString();
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      header.join(","),
      ...messages.map((m) => {
        const time = m.timestamp
          ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleString()
          : "";
        const commentList = commentsData[m.id] || [];
        const commentTexts = commentList.map((c) => `[${c.userId}] ${c.text}`);
        while (commentTexts.length < maxComments) commentTexts.push("");
        return [
          time,
          m.userId,
          m.groupId,
          m.text,
          m.likes?.length || 0,
          commentList.length,
          ...commentTexts,
        ].map(escapeCsv).join(",");
      }),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chat_history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 删除聊天记录
  const clearChat = async () => {
    const pwd = prompt("채팅 기록을 삭제하려면 비밀번호를 입력하세요.\n(주의: 삭제 후 복구 불가)");
    if (pwd !== "perper222222") {
      alert("비밀번호가 틀렸습니다. 삭제를 취소합니다.");
      return;
    }
    if (!window.confirm("정말로 모든 채팅 기록을 삭제하시겠습니까?")) return;
    const snapshot = await getDocs(collection(db, "messages"));
    for (const msg of snapshot.docs) {
      const commSnap = await getDocs(collection(db, "messages", msg.id, "comments"));
      for (const c of commSnap.docs) {
        await deleteDoc(doc(db, "messages", msg.id, "comments", c.id));
      }
      await deleteDoc(doc(db, "messages", msg.id));
    }
    alert("모든 채팅 기록이 삭제되었습니다.");
  };

  // 未进入界面：输入 ID + group
  if (!entered) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-gray-50">
        <p className="text-gray-600 mb-2 text-center">
          이 플랫폼은 익명으로 운영되는 가상의 소셜 미디어 플랫폼입니다.<br />
          사용자 ID와 그룹 번호(1~4)를 입력하세요.
        </p>
        <input
          type="text"
          placeholder="숫자 신분 ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded w-full max-w-md mb-2"
        />
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="border p-2 rounded w-full max-w-md"
        >
          <option value="1">그룹 1</option>
          <option value="2">그룹 2</option>
          <option value="3">그룹 3</option>
          <option value="4">그룹 4</option>
        </select>
        <button
          onClick={() => setEntered(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full max-w-md mt-4"
        >
          입장
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 w-full h-full flex flex-col bg-white">
      {/* 顶部按钮 + 倒计时 */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex space-x-2">
          <button onClick={downloadChat} className="bg-gray-500 text-white px-4 py-1 rounded">다운로드</button>
          <button onClick={clearChat} className="bg-red-400 text-white px-3 py-1 rounded">기록 삭제</button>
        </div>
        <div className="text-lg font-bold text-red-500">
          남은 시간: {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
        </div>
      </div>

      {/* 提示 + 发帖 */}
      {!hasPosted && (
        <div className="flex flex-col items-center justify-center flex-grow text-center p-6">
          <p className="mb-4 text-lg text-gray-700">
            생각을 입력하고 게시 버튼을 클릭하세요.<br />
            게시 후에만 다른 사람의 내용을 보고 상호작용할 수 있습니다.<br />
            이 과정은 총 3분 30초 동안 진행됩니다.
          </p>
          <div className="flex w-full max-w-lg space-x-2">
            <input
              type="text"
              placeholder="메시지를 입력하세요..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="border p-2 flex-grow rounded"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage} className="bg-green-500 text-white px-4 rounded">게시</button>
          </div>
        </div>
      )}

      {/* 帖子卡片布局 */}
      {hasPosted && (
        <>
          <div className="flex-grow overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {messages.map((m) => {
              const hasLiked = m.likes?.includes(userId);
              return (
                <div key={m.id} className="bg-gray-50 border rounded-lg p-4 flex flex-col shadow-sm">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-full text-white font-bold" style={{ backgroundColor: getAvatarColor(m.userId) }}>
                      {m.userId}
                    </div>
                    <span className="ml-3 font-semibold">G{m.groupId}</span>
                  </div>
                  <div className="text-gray-800 mb-3">{m.text}</div>
                  <div className="text-xs text-gray-500 mb-3">
                    {m.timestamp ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString() : ""}
                  </div>
                  <div className="flex items-center space-x-2 mb-3">
                    <button onClick={() => toggleLike(m)} className={`text-xl ${hasLiked ? "text-red-500" : "text-gray-400"}`}>❤️</button>
                    <span>{m.likes?.length || 0}</span>
                  </div>
                  <div className="border-t pt-2 mt-auto">
                    {commentsData[m.id]?.map((c) => (
                      <div key={c.id} className="mb-1 text-sm">
                        <b>{c.userId}</b>: {c.text}
                      </div>
                    ))}
                    <div className="flex space-x-2 mt-2">
                      <input
                        type="text"
                        placeholder="댓글을 입력하세요..."
                        value={commentInputs[m.id] || ""}
                        onChange={(e) => setCommentInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        className="border p-1 flex-grow rounded text-sm"
                        onKeyDown={(e) => e.key === "Enter" && sendComment(m.id)}
                      />
                      <button onClick={() => sendComment(m.id)} className="bg-blue-500 text-white px-3 rounded text-sm">전송</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 底部发帖区 */}
          <div className="flex space-x-2 p-4 border-t">
            <input
              type="text"
              placeholder="메시지를 입력하세요..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="border p-2 flex-grow rounded"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage} className="bg-green-500 text-white px-4 rounded">전송</button>
          </div>
        </>
      )}
    </div>
  );
}
