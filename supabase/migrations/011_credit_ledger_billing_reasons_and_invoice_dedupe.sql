alter table public.credit_ledger
  drop constraint if exists credit_ledger_reason_check;

alter table public.credit_ledger
  add constraint credit_ledger_reason_check
  check (
    reason in (
      'free_grant',
      'generation',
      'topup',
      'admin_seed',
      'migration_import',
      'daily_reset',
      'monthly_allowance',
      'plan_upgrade_proration'
    )
  );

create unique index if not exists credit_ledger_stripe_invoice_unique_idx
  on public.credit_ledger ((metadata->>'stripe_invoice_id'))
  where metadata ? 'stripe_invoice_id';
