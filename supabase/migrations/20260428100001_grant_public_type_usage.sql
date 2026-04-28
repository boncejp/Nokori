-- カスタム enum 型を API クライアント（anon / authenticated）が利用できるようにする
GRANT USAGE ON TYPE public.payday_rule TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.surplus_mode TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.transaction_type TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.utility_type TO anon, authenticated, service_role;
