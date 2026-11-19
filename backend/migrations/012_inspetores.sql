-- 012: lista de inspetores (Duarte, Luiz e Jacques adicionados)
INSERT INTO public.inspetores (nome)
SELECT n FROM unnest(ARRAY['Maik','Leandro','Ferreira','Duarte','Luiz','Jacques']) AS n
WHERE NOT EXISTS (SELECT 1 FROM public.inspetores i WHERE lower(i.nome) = lower(n));
