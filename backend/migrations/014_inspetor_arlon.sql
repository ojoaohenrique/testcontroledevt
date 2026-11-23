-- 014: inspetor Arlon adicionado
INSERT INTO public.inspetores (nome)
SELECT 'Arlon'
WHERE NOT EXISTS (SELECT 1 FROM public.inspetores WHERE lower(nome) = 'arlon');
