"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function GeneralSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">通用设置</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="py-12 text-center">
          <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">设置功能将在后续版本中提供</p>
        </div>
      </CardContent>
    </Card>
  );
}
