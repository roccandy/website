-- Controls the width of PNG artwork copied from Admin / Design Studio into email.
alter table public.settings
  add column if not exists design_clipboard_image_width int not null default 1200;

alter table public.settings
  drop constraint if exists settings_design_clipboard_image_width_check;

alter table public.settings
  add constraint settings_design_clipboard_image_width_check
  check (design_clipboard_image_width between 320 and 5000);
