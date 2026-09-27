import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

interface NotificationProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number; // in milliseconds
}

const typeClasses = {
  success: "bg-green-500 text-white",
  error: "bg-red-500 text-white",
  info: "bg-blue-500 text-white",
  warning: "bg-yellow-500 text-black",
};

const Notification: React.FC<NotificationProps> = ({
  message,
  type = "info",
  duration = 3000,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-20 right-6 flex items-center z-50 justify-between gap-4 px-4 py-3 rounded shadow-lg animate-slide-in ${typeClasses[type]}`}
      style={{ minWidth: "250px" }}
    >
      <span>{message}</span>
      <button onClick={() => setVisible(false)}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Notification;
