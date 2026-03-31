import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const team = [
  { name: "Joe Silver", role: "Admin/Ops", status: "IN", initials: "JS" },
  { name: "Quinn Titsworth", role: "CEO", status: "IN", initials: "QT" },
  { name: "Shreeya", role: "Sales & Partnerships", status: "IN", initials: "SH" },
  { name: "Callum", role: "Content & Social", status: "REMOTE", initials: "CA" },
  { name: "Patricia", role: "Production", status: "HOLIDAY", initials: "PA" },
];

const statusStyles: Record<string, { badge: string; dot: string }> = {
  IN: { badge: "bg-emerald-500/20 text-emerald-400", dot: "bg-emerald-400" },
  REMOTE: { badge: "bg-blue-500/20 text-blue-400", dot: "bg-blue-400" },
  HOLIDAY: { badge: "bg-amber-500/20 text-amber-400", dot: "bg-amber-400" },
  OUT: { badge: "bg-neutral-500/20 text-neutral-400", dot: "bg-neutral-600" },
};

const avatarColors = [
  "bg-[#D4A853]",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-pink-500",
];

export function TeamStatusWidget() {
  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <Users className="h-4 w-4 text-[#D4A853]" />
          Team Status
        </CardTitle>
        <Link href="/team" className="text-xs text-neutral-500 hover:text-neutral-300">
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {team.map((member, i) => {
          const style = statusStyles[member.status] ?? statusStyles.OUT;
          return (
            <div
              key={member.name}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-neutral-800/50"
            >
              <div className="relative">
                <Avatar className="h-7 w-7">
                  <AvatarFallback
                    className={`text-xs font-bold text-black ${avatarColors[i % avatarColors.length]}`}
                  >
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 ${style.dot}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-neutral-200">{member.name}</p>
                <p className="truncate text-[10px] text-neutral-500">{member.role}</p>
              </div>
              <Badge className={`shrink-0 text-[10px] ${style.badge}`}>
                {member.status.toLowerCase()}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
