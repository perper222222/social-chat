"use client";

import { useState, useEffect, useRef } from "react";
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
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";

// 头像颜色列表
const avatarColors = [
  "#FF6B6B", "#6BCB77", "#4D96FF", "#FFD93D", "#C77DFF",
  "#FF8E72", "#4ADEDE", "#FF9F1C", "#2EC4B6", "#E71D36"
];

const getAvatarColor = (userId) => {
  if (!userId) return avatarColors[0];
  const idx = parseInt(String(userId).replace(/\D/g, "") || "0", 10) % avatarColors.length;
  return avatarColors[idx];
};

export default function Home() {
  const [userId, setUserId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [entered, setEntered] = useState(false);
  const [hasPosted, setHasPosted] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});
  const [commentsData, setCommentsData] = useState({});
  const [countdown, setCountdown] = useState(240); // 240 秒 = 4 分钟
  const commentsUnsubRef = useRef({}); // 存放各 message 的 unsubscribe 函数

  // 进入前 / 表单校验并进入
  const handleEnter = () => {
    if (!userId.trim()) {
      alert("请输入 ID（必填）");
      return;
    }
    if (!groupId.trim()) {
      alert("请输入 Group number（必填）");
      return;
    }
    setEntered(true);
  };

  // 全局倒计时：从 entered 为 true 时开始
  useEffect(() => {
    if (!entered) return;
    setCountdown(240); // 重置为 240 秒（确保每次重新进入都从 4 分钟开始）
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // 倒计时结束：尝试关闭窗口或跳回首页（fallback）
          try {
            window.close();
            // 某些浏览器会阻止 window.close()，所以再做一次跳转
            window.location.href = "/";
          } catch (e) {
            window.location.href = "/";
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [entered]);

  // 仅在用户已发布（hasPosted）并已进入时订阅同组帖子的实时更新
  useEffect(() => {
    if (!entered || !hasPosted) return;

    // 只取相同 group 的帖子
    const q = query(
      collection(db, "messages"),
      where("groupId", "==", groupId),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });

    return () => {
      // 卸载主订阅
      unsubscribe();
      // 卸载评论订阅
      Object.values(commentsUnsubRef.current).forEach((fn) => {
        if (typeof fn === "function") fn();
      });
      commentsUnsubRef.current = {};
    };
  }, [entered, hasPosted, groupId]);

  // 当 messages 改变时，确保为每条 message 建立或更新评论监听（并能正确卸载）
  useEffect(() => {
    if (!entered || !hasPosted) return;

    // 找出当前 messages 的 id 列表
    const currentIds = messages.map((m) => m.id);

    // 卸载已经不存在的监听
    Object.keys(commentsUnsubRef.current).forEach((msgId) => {
      if (!currentIds.includes(msgId)) {
        const fn = commentsUnsubRef.current[msgId];
        if (typeof fn === "function") fn();
        delete commentsUnsubRef.current[msgId];
        setCommentsData((prev) => {
          const copy = { ...prev };
          delete copy[msgId];
          return copy;
        });
      }
    });

    // 为新的 message 建立监听
    messages.forEach((m) => {
      if (commentsUnsubRef.current[m.id]) return; // 已有监听
      const q = query(
        collection(db, "messages", m.id, "comments"),
        orderBy("timestamp", "asc")
      );
      const unsub = onSnapshot(q, (snap) => {
        const comms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCommentsData((prev) => ({ ...prev, [m.id]: comms }));
      });
      commentsUnsubRef.current[m.id] = unsub;
    });
    // 清理在组件卸载时由上面的 listeners 去做（在 message 订阅的 cleanup 中）
  }, [messages, entered, hasPosted]);

  // 发送帖子
  const sendMessage = async () => {
    if (!message.trim()) {
      alert("메시지를 입력하세요.");
      return;
    }
    try {
      await addDoc(collection(db, "messages"), {
        userId: userId.trim(),
        groupId: groupId.trim(),
        text: message.trim(),
        timestamp: serverTimestamp(),
        likes: [],
      });
      setMessage("");
      if (!hasPosted) setHasPosted(true); // 首次发帖后会触发消息加载
    } catch (err) {
      console.error("sendMessage error:", err);
      alert("메시지 전송 중 오류가 발생했습니다.");
    }
  };

  // 点赞切换
  const toggleLike = async (msg) => {
    try {
      const msgRef = doc(db, "messages", msg.id);
      const hasLiked = msg.likes?.includes(userId);
      if (hasLiked) {
        await updateDoc(msgRef, { likes: arrayRemove(userId) });
      } else {
        await updateDoc(msgRef, { likes: arrayUnion(userId) });
      }
    } catch (err) {
      console.error("toggleLike error:", err);
    }
  };

  // 发送评论
  const sendComment = async (msgId) => {
    const text = (commentInputs[msgId] || "").trim();
    if (!text) return;
    try {
      await addDoc(collection(db, "messages", msgId, "comments"), {
        userId,
        text,
        timestamp: serverTimestamp(),
      });
      setCommentInputs((prev) => ({ ...prev, [msgId]: "" }));
    } catch (err) {
      console.error("sendComment error:", err);
      alert("댓글 전송 중 오류가 발생했습니다.");
    }
  };

  // 导出 CSV（仅导出当前已加载的 messages）
  const downloadChat = () => {
    if (!messages || messages.length === 0) {
      alert("내보낼 채팅이 없습니다.");
      return;
    }
    const maxComments = Math.max(...messages.map((m) => (commentsData[m.id]?.length || 0)));
    const header = ["시간", "사용자ID", "Group", "메시지", "좋아요수", "댓글수"];
    for (let i = 1; i <= maxComments; i++) header.push(`댓글${i}`);

    const escapeCsv = (text) => {
      if (text === undefined || text === null) return "";
      const str = String(text);
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [
      header.join(","),
      ...messages.map((m) => {
        const time = m.timestamp
          ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleString()
          : "";
        const comms = commentsData[m.id] || [];
        const commTexts = comms.map((c) => `[${c.userId}] ${c.text}`);
        while (commTexts.length < maxComments) commTexts.push("");
        return [
          time,
          m.userId,
          m.groupId,
          m.text,
          m.likes?.length || 0,
          comms.length,
          ...commTexts,
        ].map(escapeCsv).join(",");
      }),
    ].join("\n");

    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat_group_${groupId || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 清空聊天记录（带密码）
  const clearChat = async () => {
    const pwd = prompt("채팅 기록을 삭제하려면 비밀번호를 입력하세요.\n(주의: 삭제 후 복구 불가)");
    if (pwd !== "perper222222") {
      alert("비밀번호가 틀렸습니다. 삭제를 취소합니다.");
      return;
    }
    if (!window.confirm("정말로 해당 그룹의 모든 채팅 기록을 삭제하시겠습니까?")) return;
    try {
      // 只删除当前 group 的消息（与下载保持一致）
      const q = query(collection(db, "messages"), where("groupId", "==", groupId));
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        const msgId = docSnap.id;
        // 删除评论
        const commSnap = await getDocs(collection(db, "messages", msgId, "comments"));
        for (const c of commSnap.docs) {
          await deleteDoc(doc(db, "messages", msgId, "comments", c.id));
        }
        // 删除消息
        await deleteDoc(doc(db, "messages", msgId));
      }
      alert("해당 그룹의 채팅 기록이 삭제되었습니다.");
    } catch (err) {
      console.error("clearChat error:", err);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  // 进入前界面：ID / Group number 输入（每个输入框前有提示）
  if (!entered) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-gray-50">
        <p className="text-gray-600 mb-4 text-center max-w-lg">
          이 플랫폼은 익명으로 운영되는 가상의 소셜 미디어 플랫폼입니다.
          <br />
          아래에 ID와 Group number를 입력한 뒤 '입장' 버튼을 눌러주세요.
        </p>

        <div className="w-full max-w-md mb-3">
          <label className="block mb-1 font-medium">ID:</label>
          <input
            type="text"
            placeholder="숫자 또는 문자로 입력"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="w-full max-w-md mb-4">
          <label className="block mb-1 font-medium">Group number:</label>
          <input
            type="text"
            placeholder="예: 1 (1~4 권장)"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <button
          onClick={handleEnter}
          className="bg-blue-600 text-white px-6 py-2 rounded"
        >
          입장
        </button>
      </div>
    );
  }

  // 已进入后：若未发帖，显示提示与发帖区（不能看到别人的内容）
  return (
    <div className="fixed top-0 left-0 w-full h-full flex flex-col bg-white">
      {/* 顶部 */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center space-x-3">
          <button onClick={downloadChat} className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-600">다운로드</button>
          <button onClick={clearChat} className="bg-red-400 text-white px-3 py-1 rounded hover:bg-red-500">기록 삭제</button>
        </div>
        <div className="text-sm text-red-600 font-semibold">
          남은 시간: {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
        </div>
      </div>

      {!hasPosted ? (
        <div className="flex flex-col items-center justify-center flex-grow p-6 text-center">
          <p className="mb-4 text-lg text-gray-700 max-w-2xl">
            생각을 입력하고 게시 버튼을 클릭하세요.
            <br />
            게시 후에만 다른 사람의 내용을 보고 상호작용할 수 있습니다.
            <br />
            이 과정은 총 3분 30초 동안 진행됩니다.
          </p>

          <div className="w-full max-w-2xl flex space-x-2 px-4">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="flex-grow border p-2 rounded"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage} className="bg-green-600 text-white px-4 py-2 rounded">게시</button>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            (참고) 당신의 ID: <b>{userId}</b> · 그룹: <b>{groupId}</b>
          </div>
        </div>
      ) : (
        <>
          {/* 帖子列表 */}
          <div
            className="flex-grow overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            style={{ minHeight: 0 }}
          >
            {messages.length === 0 && (
              <p className="text-center text-gray-400 mt-10 col-span-full">아직 게시물이 없습니다.</p>
            )}

            {messages.map((m) => {
              const hasLiked = m.likes?.includes(userId);
              const timeText = m.timestamp
                ? new Date(m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp).toLocaleTimeString()
                : "";
              return (
                <div key={m.id} className="bg-gray-50 border rounded-lg p-4 flex flex-col shadow-sm">
                  <div className="flex items-center mb-3">
                    <div
                      className="w-10 h-10 flex items-center justify-center rounded-full text-white font-bold"
                      style={{ backgroundColor: getAvatarColor(m.userId) }}
                    >
                      {m.userId}
                    </div>
                    <div className="ml-3">
                      <div className="font-semibold">{m.userId}</div>
                      <div className="text-xs text-gray-500">Group: {m.groupId}</div>
                    </div>
                  </div>

                  <div className="text-gray-800 whitespace-pre-wrap mb-3">{m.text}</div>

                  <div className="text-xs text-gray-500 mb-3">{timeText}</div>

                  <div className="flex items-center space-x-2 mb-3">
                    <button onClick={() => toggleLike(m)} className={`text-xl ${hasLiked ? "text-red-500" : "text-gray-400"}`}>❤️</button>
                    <span className="text-sm">{m.likes?.length || 0}</span>
                  </div>

                  <div className="border-t pt-2 mt-auto">
                    {(commentsData[m.id] || []).map((c) => (
                      <div key={c.id} className="mb-1 text-sm">
                        <span className="font-semibold text-xs mr-1">{c.userId}</span>
                        <span>{c.text}</span>
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
            <button onClick={sendMessage} className="bg-green-600 text-white px-4 py-2 rounded">전송</button>
          </div>
        </>
      )}
    </div>
  );
}
