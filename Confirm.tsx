import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
const ConfirmContext = createContext<(message: string) => Promise<boolean>>(
  async () => false,
);
export const useConfirm = () => useContext(ConfirmContext);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const result = useRef<((v: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  function finish(value: boolean) {
    dialog.current?.close();
    setMessage("");
    result.current?.(value);
    result.current = null;
  }
  useEffect(() => {
    if (message) dialog.current?.showModal();
  }, [message]);
  return (
    <ConfirmContext.Provider
      value={(text) =>
        new Promise<boolean>((resolve) => {
          result.current?.(false);
          result.current = resolve;
          setMessage(text);
        })
      }
    >
      {children}
      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          finish(false);
        }}
        className="confirm-dialog"
      >
        <p className="eyebrow">UN ATTIMO PRIMA DI CONTINUARE</p>
        <h2>Confermi?</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button autoFocus className="secondary" onClick={() => finish(false)}>
            Annulla
          </button>
          <button className="primary" onClick={() => finish(true)}>
            Conferma
          </button>
        </div>
      </dialog>
    </ConfirmContext.Provider>
  );
}
