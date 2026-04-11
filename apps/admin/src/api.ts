const BASE = "/admin/api";

/** TG init data is passed via URL hash when opening from mini-app */
function getTgInitData(): string {
  // Passed as ?tgInitData=... from the mini-app link
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("tgInitData") ?? "";
  if (fromQuery) {
    sessionStorage.setItem("admin_tg_init_data", fromQuery);
    return fromQuery;
  }
  return sessionStorage.getItem("admin_tg_init_data") ?? "";
}

function getStaticToken(): string {
  return localStorage.getItem("admin_token") ?? "";
}

function authHeaders(): Record<string, string> {
  const tg = getTgInitData();
  if (tg) return { "X-Telegram-Init-Data": tg };
  return { "X-Admin-Token": getStaticToken() };
}

async function request<T>(
  path: string,
  params?: Record<string, string | number>,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      ...init,
      headers: {
        ...authHeaders(),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Нет соединения с API сервером");
  }
  if (res.status === 401) throw new Error("unauthorized");
  if (res.status === 403) throw new Error("not_admin");
  if (!res.ok) throw new Error(`Ошибка сервера: HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("API сервер недоступен");
  }
  return res.json() as Promise<T>;
}

export const api = {
  overview: (days: number) => request<OverviewData>("/overview", { days }),
  timeseries: (days: number) => request<TimeseriesData>("/timeseries", { days }),
  revenue: (days: number) => request<RevenueData>("/revenue", { days }),
  generations: (days: number) => request<GenerationsData>("/generations", { days }),
  lifecycleOverview: (days: number) => request<LifecycleOverviewData>("/lifecycle/overview", { days }),
  lifecycleUsers: (params: { state?: string; page?: number; limit?: number; search?: string }) =>
    request<LifecycleUsersData>("/lifecycle/users", params as Record<string, string | number>),
  lifecycleTimeline: (userId: string) =>
    request<LifecycleTimelineData>(`/lifecycle/users/${encodeURIComponent(userId)}/timeline`),
  lifecycleForceTransition: (userId: string, toState: string, reason: string) =>
    request<{ ok: boolean; from_state: string; to_state: string }>(
      `/lifecycle/users/${encodeURIComponent(userId)}/transition`,
      undefined,
      { method: "POST", body: JSON.stringify({ to_state: toState, reason }) },
    ),
  lifecycleLock: (userId: string, reason: string) =>
    request<{ ok: boolean; locked: boolean }>(
      `/lifecycle/users/${encodeURIComponent(userId)}/lock`,
      undefined,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  lifecycleUnlock: (userId: string, reason: string) =>
    request<{ ok: boolean; locked: boolean; state: string }>(
      `/lifecycle/users/${encodeURIComponent(userId)}/unlock`,
      undefined,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  lifecycleRecompute: (userId: string, reason: string) =>
    request<{ ok: boolean; state: string }>(
      `/lifecycle/users/${encodeURIComponent(userId)}/recompute`,
      undefined,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  users: (params: { page?: number; limit?: number; search?: string; filter?: string }) =>
    request<UsersData>("/users", params as Record<string, string | number>),
  userDetail: (userId: string) => request<UserDetailData>(`/users/${encodeURIComponent(userId)}`),
};

// ─── Types ───────────────────────────────────────────────────────

export interface OverviewData {
  period_days: number;
  users: {
    total: number;
    paying: number;
    conversion_pct: number;
    new_today: number;
    new_period: number;
    dau: number;
  };
  generations: {
    today: { done: number; failed: number; total: number };
    period: { done: number; failed: number; total: number };
    alltime_done: number;
    alltime_total: number;
    error_rate_pct: number;
  };
  revenue: {
    today_stars: number;
    period_stars: number;
    alltime_stars: number;
    arppu_stars: number;
  };
  queue: {
    orders: Record<string, number>;
    jobs: Record<string, number>;
  };
}

export interface TimeseriesData {
  days: number;
  users: Array<{ day: string; new_users: number }>;
  orders: Array<{ day: string; total: number; done: number; failed: number }>;
  revenue: Array<{ day: string; stars: number }>;
}

export interface RevenueData {
  period_days: number;
  totals: {
    stars: number;
    payments: number;
    paying_users: number;
    arppu_stars: number;
    refunded: number;
  };
  by_package: Array<{ package_code: string; payments_count: number; total_stars: number; unique_buyers: number }>;
  recent: Array<{
    payment_id: string;
    user_id: string;
    username: string | null;
    first_name: string | null;
    package_code: string;
    amount: number;
    status: string;
    provider: string;
    created_at: string;
  }>;
}

export interface GenerationsData {
  period_days: number;
  by_status: Record<string, number>;
  top_styles: Array<{ style_code: string; count: number; done: number }>;
  by_model: Array<{ model_id: string; total: number; done: number; failed: number; avg_cost: number }>;
  recent_failed: Array<{
    order_id: string;
    user_id: string;
    model_id: string;
    style_code: string;
    fail_reason_code: string | null;
    created_at: string;
    provider: string | null;
    attempts: number | null;
    job_status: string | null;
  }>;
  avg_gen_seconds: number | null;
}

export interface UsersData {
  users: Array<{
    user_id: string;
    first_name: string | null;
    username: string | null;
    paid_credits: number;
    created_at: string;
    gens_done: number;
    total_stars: number;
  }>;
  total: number;
  page: number;
  pages: number;
}

export interface UserDetailData {
  user: Record<string, unknown>;
  stats: {
    total_orders: number;
    done_orders: number;
    failed_orders: number;
    coins_spent: number;
    total_stars_paid: number;
  };
  orders: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
}

export interface LifecycleOverviewData {
  period_days: number;
  states: Record<string, number>;
  locked_users: number;
  transitions_total: number;
  transitions_daily: Array<{ day: string; transitions: number }>;
}

export interface LifecycleUsersData {
  users: Array<{
    user_id: string;
    first_name: string | null;
    username: string | null;
    paid_credits: number;
    lifecycle_state: string;
    lifecycle_state_updated_at: string | null;
    lifecycle_locked: boolean;
    last_success_generation_at: string | null;
    last_payment_at: string | null;
    created_at: string;
  }>;
  total: number;
  page: number;
  pages: number;
}

export interface LifecycleTimelineData {
  user: {
    user_id: string;
    lifecycle_state: string;
    lifecycle_locked: boolean;
    lifecycle_state_updated_at: string | null;
  };
  transitions: Array<{
    transition_id: number;
    from_state: string | null;
    to_state: string;
    reason: string;
    source: string;
    actor: string | null;
    metadata_json: string | null;
    created_at: string;
  }>;
  admin_actions: Array<{
    action_id: number;
    action_type: string;
    actor: string;
    reason: string;
    from_state: string | null;
    to_state: string | null;
    metadata_json: string | null;
    created_at: string;
  }>;
}
