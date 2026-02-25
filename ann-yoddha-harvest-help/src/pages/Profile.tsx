import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Phone, MapPin, Globe } from "lucide-react";

const fields = [
  { key: "name", label: "Full Name", icon: User },
  { key: "phone", label: "Phone", icon: Phone },
  { key: "region", label: "Region", icon: MapPin },
  { key: "language", label: "Language", icon: Globe },
] as const;

const Profile = () => {
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => api.getProfile() });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-display text-3xl font-bold">Your Profile</h1>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle>Farmer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {fields.map((f) => (
              <div key={f.key} className="flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-5 w-40" />
                  ) : (
                    <p className="font-medium">{(data as any)?.[f.key] || "—"}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Profile;
