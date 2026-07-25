import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appClient.auth.me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-10 bg-secondary rounded w-48"/><div className="h-10 bg-secondary rounded"/><div className="h-10 bg-secondary rounded"/></div>;

  return (
    <div>
      <h2 className="font-display text-xl font-bold mb-6">Profile</h2>
      <div className="max-w-md space-y-6">
        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
          <User className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <Label className="text-xs tracking-widest text-muted-foreground">FULL NAME</Label>
          <Input value={user?.fullName || ""} readOnly className="mt-1.5 bg-secondary border-0" />
        </div>
        <div>
          <Label className="text-xs tracking-widest text-muted-foreground">EMAIL</Label>
          <Input value={user?.email || ""} readOnly className="mt-1.5 bg-secondary border-0" />
        </div>
        <div>
          <Label className="text-xs tracking-widest text-muted-foreground">ROLE</Label>
          <Input value={user?.role || ""} readOnly className="mt-1.5 bg-secondary border-0" />
        </div>
      </div>
    </div>
  );
}

