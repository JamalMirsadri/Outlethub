import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { mergeGuestCart } from "@/api/commerce";
import { toast } from "@/components/ui/use-toast";
import { register, resendVerification, verifyEmail } from "@/services/auth.service";

export default function Register() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const registerRequestRef = useRef(false);
  const verifyRequestRef = useRef(false);
  const resendRequestRef = useRef(false);

  useEffect(() => {
    const referralCodeFromQuery = searchParams.get("ref")?.trim().toUpperCase() ?? "";
    if (referralCodeFromQuery) {
      setReferralCode(referralCodeFromQuery);
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError(t("common.passwordMismatch"));
      return;
    }

    if (registerRequestRef.current) {
      return;
    }

    registerRequestRef.current = true;
    setLoading(true);
    try {
      await register({
        email,
        password,
        confirmPassword,
        referralCode: referralCode.trim().toUpperCase() || undefined,
      });
      setShowOtp(true);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : t("auth.registerFailed"));
    } finally {
      registerRequestRef.current = false;
      setLoading(false);
    }
  };

  const handleVerify = async (): Promise<void> => {
    setError("");
    if (verifyRequestRef.current) {
      return;
    }

    verifyRequestRef.current = true;
    setLoading(true);
    try {
      await verifyEmail(otpCode);
      await mergeGuestCart().catch(() => undefined);
      window.location.href = "/";
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : t("common.somethingWentWrong"));
    } finally {
      verifyRequestRef.current = false;
      setLoading(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    setError("");
    if (resendRequestRef.current) {
      return;
    }

    resendRequestRef.current = true;
    try {
      await resendVerification(email);
      toast({
        title: t("common.success"),
        description: t("auth.resetEmailSent"),
      });
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : t("common.somethingWentWrong"));
    } finally {
      resendRequestRef.current = false;
    }
  };

  const handleGoogle = (): void => {
    setError(t("auth.googleUnavailable"));
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title={t("common.confirm")}
        subtitle={t("auth.resetEmailSent")}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("common.processing")}
            </>
          ) : (
            t("common.confirm")
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {t("common.tryAgain")}{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            {t("common.retry")}
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
      footer={
        <>
          {t("auth.accountExists")}{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            {t("auth.loginHere")}
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
        type="button"
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        {t("auth.continueWithGoogle")}
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">{t("common.or")}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("common.email")}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={t("auth.passwordPlaceholder")}
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder={t("auth.passwordPlaceholder")}
              value={confirmPassword}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setConfirmPassword(event.target.value)
              }
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="referralCode">{t("auth.referralCode")}</Label>
          <Input
            id="referralCode"
            type="text"
            autoComplete="off"
            placeholder={t("auth.referralCodeOptional")}
            value={referralCode}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setReferralCode(event.target.value.toUpperCase())
            }
            className="h-12"
          />
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("auth.creatingAccount")}
            </>
          ) : (
            t("auth.createAccount")
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
