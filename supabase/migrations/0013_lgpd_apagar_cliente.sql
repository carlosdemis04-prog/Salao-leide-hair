-- LGPD: a cliente pode pedir para apagar os dados dela (art. 18 da LGPD).
-- O painel ganha o botão "Apagar dados da cliente" na ficha, que chama esta função.
-- O que acontece:
--   * ficha (aniversário, anotações), Lady Points, prêmios, convites, cupons e a conta Google dela são apagados;
--   * os agendamentos ficam, mas sem nome nem telefone ("Cliente removida"), para os números do salão
--     (quanto entrou no mês) continuarem certos. O Google Agenda também passa a mostrar "Cliente removida".
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0012). Pode rodar de novo sem problema.

create or replace function public.lgpd_apagar_cliente(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Mesmo formato das Lady Points: só números, sem o 55 do Brasil
  v_tel text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 11);
  v_agendamentos integer;
  v_contas integer;
begin
  if not is_admin() then
    raise exception 'sem_permissao';
  end if;
  if length(v_tel) < 10 then
    raise exception 'telefone_invalido';
  end if;

  -- Agendamentos: tira nome e telefone, mantém serviço, data e valor
  update appointments
     set client_name = 'Cliente removida', client_phone = ''
   where right(client_phone, 11) = v_tel;
  get diagnostics v_agendamentos = row_count;

  -- Conta Google da cliente (nunca apaga a conta de quem é administradora)
  delete from auth.users u
   where u.id in (select c.user_id from contas_clientes c where right(coalesce(c.phone, ''), 11) = v_tel)
     and u.id not in (select a.user_id from admins a);
  get diagnostics v_contas = row_count;
  delete from contas_clientes where right(coalesce(phone, ''), 11) = v_tel;

  delete from lady_resgates where right(phone, 11) = v_tel;
  delete from lady_pontos where right(phone, 11) = v_tel;
  delete from lady_aparelhos where right(phone, 11) = v_tel;

  delete from convite_cupons where right(phone, 11) = v_tel;
  delete from convite_indicacoes where right(indicada_phone, 11) = v_tel;
  -- Se ela convidou amigas, a indicação some do lado dela, mas as amigas continuam com seus cupons
  delete from convite_indicacoes where right(madrinha_phone, 11) = v_tel;
  delete from convite_codigos where right(phone, 11) = v_tel;

  delete from clients where right(phone, 11) = v_tel;

  return jsonb_build_object('agendamentos', v_agendamentos, 'contas', v_contas);
end;
$$;

revoke all on function public.lgpd_apagar_cliente(text) from public, anon;
grant execute on function public.lgpd_apagar_cliente(text) to authenticated;
