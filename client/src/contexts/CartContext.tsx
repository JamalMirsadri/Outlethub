import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  addCartItem,
  clearCart,
  getCart,
  mergeGuestCart,
  removeCartItem,
  type CartRecord,
  updateCartCountry,
  updateCartItem,
} from "@/api/commerce";
import { useAuth } from "@/contexts/AuthContext";

const EMPTY_CART: CartRecord = {
  id: null,
  itemCount: 0,
  currency: "EUR",
  countryCode: "PT",
  subtotalAmount: 0,
  shippingAmount: 0,
  handlingAmount: 0,
  paymentFeeAmount: 0,
  taxAmount: 0,
  totalAmount: 0,
  promotion: null,
  items: [],
  shippingMethod: null,
};

interface CartContextValue {
  cart: CartRecord;
  itemCount: number;
  isLoadingCart: boolean;
  isMutatingCart: boolean;
  cartReady: boolean;
  refreshCart: () => Promise<CartRecord>;
  addItem: (payload: { productId: string; variantId?: string | null; quantity: number }) => Promise<CartRecord>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<CartRecord>;
  removeItem: (itemId: string) => Promise<CartRecord>;
  clearItems: () => Promise<CartRecord>;
  changeCountry: (payload: { countryCode: string; shippingMethodId?: string | null }) => Promise<CartRecord>;
  mergeGuestIntoUserCart: () => Promise<CartRecord>;
}

const CartContext = createContext<CartContextValue | null>(null);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const { authChecked, isAuthenticated } = useAuth();
  const [cart, setCart] = useState<CartRecord>(EMPTY_CART);
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [isMutatingCart, setIsMutatingCart] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const syncStateRef = useRef<string | null>(null);

  const applyCart = useCallback((nextCart: CartRecord) => {
    setCart(nextCart);
    setCartReady(true);
    return nextCart;
  }, []);

  const refreshCart = useCallback(async () => {
    const nextCart = await getCart();
    return applyCart(nextCart);
  }, [applyCart]);

  const mergeGuestIntoUserCart = useCallback(async () => {
    const nextCart = await mergeGuestCart();
    return applyCart(nextCart);
  }, [applyCart]);

  const runMutation = useCallback(
    async (action: () => Promise<CartRecord>) => {
      setIsMutatingCart(true);
      try {
        return await action();
      } finally {
        setIsMutatingCart(false);
      }
    },
    [],
  );

  const addItem = useCallback(
    async (payload: { productId: string; variantId?: string | null; quantity: number }) =>
      runMutation(async () => applyCart(await addCartItem(payload))),
    [applyCart, runMutation],
  );

  const updateItemQuantity = useCallback(
    async (itemId: string, quantity: number) =>
      runMutation(async () => applyCart(await updateCartItem(itemId, { quantity }))),
    [applyCart, runMutation],
  );

  const removeItem = useCallback(
    async (itemId: string) => runMutation(async () => applyCart(await removeCartItem(itemId))),
    [applyCart, runMutation],
  );

  const clearItems = useCallback(
    async () => runMutation(async () => applyCart(await clearCart())),
    [applyCart, runMutation],
  );

  const changeCountry = useCallback(
    async (payload: { countryCode: string; shippingMethodId?: string | null }) =>
      runMutation(async () => applyCart(await updateCartCountry(payload))),
    [applyCart, runMutation],
  );

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    const syncKey = isAuthenticated ? "user" : "guest";
    if (syncStateRef.current === syncKey) {
      return;
    }

    syncStateRef.current = syncKey;
    setIsLoadingCart(true);

    const syncCart = async () => {
      try {
        if (isAuthenticated) {
          await mergeGuestIntoUserCart();
        } else {
          await refreshCart();
        }
      } catch {
        applyCart(EMPTY_CART);
      } finally {
        setIsLoadingCart(false);
      }
    };

    void syncCart();
  }, [applyCart, authChecked, isAuthenticated, mergeGuestIntoUserCart, refreshCart]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cart.itemCount,
      isLoadingCart,
      isMutatingCart,
      cartReady,
      refreshCart,
      addItem,
      updateItemQuantity,
      removeItem,
      clearItems,
      changeCountry,
      mergeGuestIntoUserCart,
    }),
    [
      addItem,
      cart,
      cartReady,
      changeCountry,
      clearItems,
      isLoadingCart,
      isMutatingCart,
      mergeGuestIntoUserCart,
      refreshCart,
      removeItem,
      updateItemQuantity,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
}
