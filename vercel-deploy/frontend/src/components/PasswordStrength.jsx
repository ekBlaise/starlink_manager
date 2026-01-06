import { useState, useMemo } from "react";

export const PasswordStrength = ({ password }) => {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    
    let score = 0;
    
    // Length checks
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    
    // Determine label and color
    if (score <= 2) return { score: 1, label: "Weak", color: "bg-red-500" };
    if (score <= 4) return { score: 2, label: "Medium", color: "bg-yellow-500" };
    if (score <= 6) return { score: 3, label: "Strong", color: "bg-green-500" };
    return { score: 4, label: "Very Strong", color: "bg-emerald-500" };
  }, [password]);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${
              level <= strength.score ? strength.color : "bg-secondary"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${
        strength.score <= 1 ? "text-red-400" : 
        strength.score <= 2 ? "text-yellow-400" : 
        "text-green-400"
      }`}>
        Password strength: {strength.label}
      </p>
      {strength.score <= 2 && (
        <p className="text-xs text-muted-foreground">
          Add uppercase, numbers, or special characters for a stronger password
        </p>
      )}
    </div>
  );
};

export default PasswordStrength;
