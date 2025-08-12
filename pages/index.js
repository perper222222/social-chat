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
} from "firebase/firestore";
import { db } from "../lib/firebase";

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
  // 登录状态
  const [userId, setUserId] = useState("");
  const [groupNum, setGroupNum] = useState("");
  const [entered, setEntered] = useState(false);

  // 聊天状态
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentsData, setCommentsData] = useState({});

  // 是否已发第一条消息，控制显示聊天内容
  const [hasPostedFirstMsg, setHasPostedFirstMsg] = useState(false);

  // 4分钟倒计时
  const [timeLeft, setTimeLeft] = useState(240);
  const timerRef = useRef(null);

  // 登录后且已发第一条消息才订阅消息
  useEffect(() => {
    if (!entered || !hasPostedFirstMsg) return;

    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [entered, hasPostedFirstMsg]);

  // 默认展开所有评论
  useEffect(() => {
    if (!entered || !hasPostedFirstMsg) return;

    setOpenComments(
      messages.reduce((acc, msg) => {
        acc[msg.id] = true;
        return acc;
      }, {})
    );
  }, [messages, entered, hasPostedFirstMsg]);

  // 监听评论变化
  useEffect(() => {
    if (!entered || !hasPostedFirstMsg) return;

    const unsubscribes = Object.entries(openComments)
      .filter(([, isOpen]) => isOpen)
      .map(([msgId]) => {
        const q = query(
          collection(db, "messages", msgId, "comments"),
          orderBy("timestamp", "asc")
        );
        return onSnapshot(q, (snapshot) => {
          const comms = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setCommentsData((prev) => ({ ...prev, [msgId]: comms }));
        });
      });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [openComments, entered, hasPostedFirstMsg]);

  // 发送消息函数
  const sendMessage = async () => {
    if (!message.trim()) return;

    await addDoc(collection(db, "messages"), {
      userId,
      groupNum,
      text: message,
      timestamp: serverTimestamp(),
      likes: [],
    });
    setMessage("");
    if (!hasPostedFirstMsg) setHasPostedFirstMsg(true);
  };

  // 点赞/取消点赞
  const toggleLike = async (msg) => {
    const msgRef = doc(db, "messages", msg.id);
    const hasLiked = msg.likes?.includes(userId);

    if (hasLiked) {
      await updateDoc(msgRef, {
        likes: arrayRemove(userId),
      });
    } else {
      await updateDoc(msgRef, {
        likes: arrayUnion(userId),
      });
    }
  };

  // 发送评论
  const sendComment = async (msgId) => {
    const text = commentInputs[msgId]?.trim();
    if (!text) return;

    try {
      await addDoc(collection(db, "messages", msgId, "comments"), {
        userId,
        text,
        timestamp: serverTimestamp(),
      });
      setCommentInputs((prev) => ({ ...prev, [msgId]: "" }));
    } catch (error) {
      console.error("댓글 전송 실패:", error);
      alert("댓글 전송 중 오류가 발생했습니다.");
    }
  };

  // 下载聊天记录
  const downloadChat = () => {
    if (messages.length === 0) return;

    const maxComments = Math.max(
      ...messages.map((m) => commentsData[m.id]?.length || 0)
    );

    const header = ["시간", "사용자ID", "그룹번호", "메시지", "좋아요수", "댓글수"];

    for (let i = 1; i <= maxComments; i++) {
      header.push(`댓글${i}`);
    }

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
          ? new Date(
              m.timestamp.seconds
                ? m.timestamp.seconds * 1000
                : m.timestamp
            ).toLocaleString()
          : "";
        const commentList = commentsData[m.id] || [];
        const commentCount = commentList.length;
        const commentTexts = commentList.map((c) => `[${c.userId}] ${c.text}`);
        while (commentTexts.length < maxComments) {
          commentTexts.push("");
        }
        return [
          time,
          m.userId,
          m.groupNum || "",
          m.text,
          m.likes?.length || 0,
          commentCount,
          ...commentTexts,
        ]
          .map(escapeCsv)
          .join(",");
      }),
    ];

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "chat_history.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  // 清除聊天记录
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
      for (const msg of messages) {
        const commSnap = await getDocs(
          collection(db, "messages", msg.id, "comments")
        );
        const deleteComms = commSnap.docs.map((docSnap) =>
          deleteDoc(doc(db, "messages", msg.id, "comments", docSnap.id))
        );
        await Promise.all(deleteComms);
      }

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

  // 倒计时逻辑
  useEffect(() => {
    if (!entered) {
      setTimeLeft(240);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            alert("시간이 종료되어 자동으로 로그아웃 됩니다.");
            setEntered(false);
            setHasPostedFirstMsg(false);
            setUserId("");
            setGroupNum("");
            setMessage("");
            setMessages([]);
            setCommentInputs({});
            setCommentsData({});
            setOpenComments({});
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [entered]);

  // 仅允许数字输入
  const handleUserIdChange = (e) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) setUserId(val);
  };
  const handleGroupNumChange = (e) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) setGroupNum(val);
  };

  // 未登录界面：输入ID和Group
  if (!entered) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4 bg-gray-50">
        <p className="text-gray-600 mb-2 text-center max-w-md">
          이 플랫폼은 익명으로 운영되는 가상의 소셜 미디어 플랫폼입니다.<br />
          사용자 ID(숫자)와 그룹 번호(1~4)를 입력하시면 게시글 작성, 좋아요, 댓글 등 다양한 소셜 미디어 활동을 체험할 수 있습니다.
        </p>
        <label className="w-full max-w-md mb-2">
          <div className="mb-1 font-semibold">ID (숫자)</div>
          <input
            type="text"
            placeholder="숫자 신분 ID를 입력하세요"
            value={userId}
            onChange={handleUserIdChange}
            className="border p-2 rounded w-full"
            maxLength={10}
          />
        </label>
        <label className="w-full max-w-md mb-4">
          <div className="mb-1 font-semibold">Group Number (1~4)</div>
          <input
            type="text"
            placeholder="그룹 번호를 입력하세요"
