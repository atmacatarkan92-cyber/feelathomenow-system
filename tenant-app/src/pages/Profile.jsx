import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCircle, Save, Camera } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/shared/PageHeader";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ phone: "", language: "de", profile_photo_url: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm({
        phone: u.phone || "",
        language: u.language || "de",
        profile_photo_url: u.profile_photo_url || "",
      });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe(form);
    toast.success("Profil gespeichert");
    setSaving(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, profile_photo_url: file_url }));
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Mein Profil" subtitle="Persönliche Informationen verwalten" />

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          {/* Photo */}
          <div className="flex items-center gap-5 mb-8">
            <div className="relative">
              {form.profile_photo_url ? (
                <img src={form.profile_photo_url} alt="" className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-200 flex items-center justify-center">
                  <UserCircle className="w-10 h-10 text-slate-400" />
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors">
                <Camera className="w-3.5 h-3.5" />
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </label>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">{user.full_name}</h3>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <Label>Name</Label>
                <Input value={user.full_name || ""} disabled className="bg-slate-50 mt-1" />
              </div>
              <div>
                <Label>E-Mail</Label>
                <Input value={user.email || ""} disabled className="bg-slate-50 mt-1" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <Label>Telefonnummer</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+41 79 000 00 00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Sprache</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}