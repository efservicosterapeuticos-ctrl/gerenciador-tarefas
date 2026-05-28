async function getUsuariosLogin() {
  const { data } = await sb.from('users').select('id, nome').order('nome');
  return data || [];
}

async function loginComPin(userId, pin) {
  try {
    const { data, error } = await sb
      .from('users')
      .select('id, nome, perfil')
      .eq('id', userId)
      .eq('pin', pin)
      .single();

    if (error || !data) {
      return { success: false, message: 'PIN incorreto. Tente novamente.' };
    }

    const sessao = { id: data.id, nome: data.nome, perfil: data.perfil };
    localStorage.setItem('sessao', JSON.stringify(sessao));
    return { success: true, perfil: data.perfil };
  } catch {
    return { success: false, message: 'Erro ao conectar. Tente novamente.' };
  }
}

function getSessao() {
  try {
    return JSON.parse(localStorage.getItem('sessao'));
  } catch {
    return null;
  }
}

function logout() {
  localStorage.removeItem('sessao');
}
