import { Show, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { session, loading } from "../../stores/authStore";

interface Props {
  children: JSX.Element;
}

/**
 * Route guard — redirects to /admin/login if not authenticated.
 * Wrap any admin page with this component.
 */
export function AuthGuard(props: Props) {
  const navigate = useNavigate();

  return (
    <Show
      when={!loading()}
      fallback={
        <div class="min-h-screen bg-[#10141d] flex items-center justify-center text-[#b1a59a]/50">
          กำลังตรวจสอบสิทธิ์...
        </div>
      }
    >
      <Show
        when={session()}
        fallback={(() => {
          navigate("/admin/login", { replace: true });
          return null;
        })()}
      >
        {props.children}
      </Show>
    </Show>
  );
}
