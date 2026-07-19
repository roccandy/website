-- Correct known public metadata issues found during the July 2026 site audit.
-- Apply with:
-- npm run db:apply-sql -- docs/sql/2026-07-19-public-seo-corrections.sql

update public.blog_posts
set canonical_url = 'https://roccandy.com.au/blog/why-branded-candy-makes-a-great-corporate-gift',
    updated_at = now()
where slug = 'why-branded-candy-makes-a-great-corporate-gift';

update public.blog_posts
set seo_title = 'Baby Shower Candy Ideas | OH BOY & HEY GIRL | Roc Candy',
    meta_description = 'Celebrate a baby shower or gender reveal with handmade OH BOY, HEY GIRL or personalised rock candy favours. Australian made with free delivery.',
    updated_at = now()
where slug = 'baby-shower-candy-oh-boy-hey-girl';

update public.premade_candies
set meta_description = 'Shop handmade Watermelon Rock Candy in a 500g pack. Australian made, vegan and gluten free, with free delivery Australia-wide from Roc Candy.'
where slug = 'watermelon-rock-candy';

update public.premade_candies
set meta_description = 'Share colourful Smiley Rock Candy made in Australia. Vegan and gluten free, available in a 500g pack with free delivery Australia-wide from Roc Candy.'
where slug = 'smiley-rock-candy';
