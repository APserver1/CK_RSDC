-- Corrige los valores de la tabla vieja de viáticos según la tabla oficial.
update public.ck_viatico_rates as rates
set valor = corrected.valor
from (values
  ('I', 1, 2375.00), ('I', 2, 2062.50), ('I', 3, 1750.00),
  ('II', 1, 2062.50), ('II', 2, 1750.00), ('II', 3, 1437.50),
  ('III', 1, 1750.00), ('III', 2, 1437.50), ('III', 3, 1125.00),
  ('IV', 1, 1437.50), ('IV', 2, 1125.00), ('IV', 3, 812.50),
  ('V', 1, 1125.00), ('V', 2, 812.50), ('V', 3, 775.00)
) as corrected(categoria, zona, valor)
where rates.tabla_codigo = 'legacy'
  and rates.categoria = corrected.categoria
  and rates.zona = corrected.zona;
