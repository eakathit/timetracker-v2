// src/components/UserAvatar.tsx
"use client";

interface UserAvatarProps {
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  userId?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-2xl",
};

export default function UserAvatar({
  avatarUrl,
  firstName,
  lastName,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const initial = firstName
    ? firstName.charAt(0).toUpperCase()
    : lastName
    ? lastName.charAt(0).toUpperCase()
    : "?";

  return (
    <div className={`${SIZE_MAP[size]} rounded-xl overflow-hidden flex-shrink-0 ${className}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${firstName ?? ""} ${lastName ?? ""}`.trim() || "avatar"}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-extrabold">
          {initial}
        </div>
      )}
    </div>
  );
}