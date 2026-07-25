declare module "@/components/ui/button" {
  import type { ButtonHTMLAttributes, ForwardRefExoticComponent, ReactNode, RefAttributes } from "react";

  export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    variant?: string;
    size?: string;
    children?: ReactNode;
  }

  export const Button: ForwardRefExoticComponent<
    ButtonProps & RefAttributes<HTMLButtonElement>
  >;
}

declare module "@/components/ui/input" {
  import type { ForwardRefExoticComponent, InputHTMLAttributes, RefAttributes } from "react";

  export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

  export const Input: ForwardRefExoticComponent<
    InputProps & RefAttributes<HTMLInputElement>
  >;
}

declare module "@/components/ui/label" {
  import type { ForwardRefExoticComponent, LabelHTMLAttributes, ReactNode, RefAttributes } from "react";

  export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    children?: ReactNode;
  }

  export const Label: ForwardRefExoticComponent<
    LabelProps & RefAttributes<HTMLLabelElement>
  >;
}

declare module "@/components/ui/input-otp" {
  import type { HTMLAttributes, ReactNode } from "react";

  export interface InputOTPProps extends HTMLAttributes<HTMLDivElement> {
    maxLength: number;
    value: string;
    onChange: (value: string) => void;
    autoFocus?: boolean;
    autoComplete?: string;
    children?: ReactNode;
  }

  export function InputOTP(props: InputOTPProps): JSX.Element;
  export function InputOTPGroup(props: { children?: ReactNode }): JSX.Element;
  export function InputOTPSlot(props: { index: number }): JSX.Element;
}

declare module "@/components/ui/use-toast" {
  export interface ToastOptions {
    title?: string;
    description?: string;
    variant?: string;
  }

  export function toast(options: ToastOptions): void;
}

declare module "@/components/ui/toaster" {
  export function Toaster(): JSX.Element;
}

declare module "@/components/ui/badge" {
  import type { HTMLAttributes, ReactNode } from "react";

  export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
    variant?: string;
    children?: ReactNode;
  }

  export function Badge(props: BadgeProps): JSX.Element;
}

declare module "@/components/ui/checkbox" {
  import type { ButtonHTMLAttributes } from "react";

  export interface CheckboxProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }

  export function Checkbox(props: CheckboxProps): JSX.Element;
}

declare module "@/components/ui/dialog" {
  import type { HTMLAttributes, ReactNode } from "react";

  export function Dialog(props: { open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode }): JSX.Element;
  export function DialogContent(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): JSX.Element;
  export function DialogHeader(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): JSX.Element;
  export function DialogTitle(props: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }): JSX.Element;
}

declare module "@/components/ui/dropdown-menu" {
  import type { HTMLAttributes, ReactNode } from "react";

  export function DropdownMenu(props: { children?: ReactNode }): JSX.Element;
  export function DropdownMenuTrigger(props: { asChild?: boolean; children?: ReactNode }): JSX.Element;
  export function DropdownMenuContent(props: HTMLAttributes<HTMLDivElement> & { align?: string; children?: ReactNode }): JSX.Element;
  export function DropdownMenuItem(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): JSX.Element;
}

declare module "@/components/ui/select" {
  import type { HTMLAttributes, ReactNode } from "react";

  export function Select(props: { value?: string; onValueChange?: (value: string) => void; disabled?: boolean; children?: ReactNode }): JSX.Element;
  export function SelectTrigger(props: HTMLAttributes<HTMLButtonElement> & { children?: ReactNode }): JSX.Element;
  export function SelectValue(props: { placeholder?: string }): JSX.Element;
  export function SelectContent(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): JSX.Element;
  export function SelectItem(props: HTMLAttributes<HTMLDivElement> & { value: string; children?: ReactNode }): JSX.Element;
}

declare module "@/components/ui/card" {
  import type { HTMLAttributes, ReactNode } from "react";

  export function Card(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): JSX.Element;
  export function CardHeader(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): JSX.Element;
  export function CardTitle(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): JSX.Element;
  export function CardDescription(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): JSX.Element;
  export function CardContent(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): JSX.Element;
  export function CardFooter(props: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }): JSX.Element;
}

declare module "@/components/ui/separator" {
  import type { HTMLAttributes } from "react";

  export function Separator(props: HTMLAttributes<HTMLDivElement>): JSX.Element;
}

declare module "@/components/ui/textarea" {
  import type { ForwardRefExoticComponent, RefAttributes, TextareaHTMLAttributes } from "react";

  export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

  export const Textarea: ForwardRefExoticComponent<
    TextareaProps & RefAttributes<HTMLTextAreaElement>
  >;
}
