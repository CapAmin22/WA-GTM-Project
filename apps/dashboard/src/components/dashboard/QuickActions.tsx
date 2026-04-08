import { useState } from "react";
import { Pause, Play, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function QuickActions() {
  const [isPaused, setIsPaused] = useState(false);
  const [quickSendOpen, setQuickSendOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isPaused ? "default" : "destructive"}
        size="sm"
        onClick={() => setIsPaused(!isPaused)}
        className="gap-1.5 text-xs"
      >
        {isPaused ? (
          <>
            <Play className="h-3.5 w-3.5" /> Resume
          </>
        ) : (
          <>
            <Pause className="h-3.5 w-3.5" /> Pause All
          </>
        )}
      </Button>

      <Dialog open={quickSendOpen} onOpenChange={setQuickSendOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" /> Quick Send
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Send</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs">Phone Number</Label>
              <Input placeholder="+91 9876543210" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Message</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[100px]"
                placeholder="Type your message..."
              />
            </div>
            <Button className="w-full" size="sm">
              Send Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Button variant="ghost" size="sm" className="text-xs">
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
