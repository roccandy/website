-- Permit compact, email-friendly clipboard previews while retaining legibility.
alter table public.settings
  drop constraint if exists settings_design_clipboard_image_width_check;

alter table public.settings
  add constraint settings_design_clipboard_image_width_check
  check (design_clipboard_image_width between 100 and 5000);
