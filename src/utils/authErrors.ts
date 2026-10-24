/**
 * Converts provider-specific Auth errors into stable, non-enumerating UI copy.
 * The original provider message is intentionally never returned to the DOM.
 */
export function normalizeAuthError(message: string) {
  if (message.includes('Invalid login credentials')) {
    return new Error('Email ou mot de passe incorrect');
  }
  if (message.includes('Password should be at least')) {
    return new Error('Le mot de passe ne respecte pas la longueur minimale requise');
  }
  if (message.includes('User already registered')) {
    return new Error('Impossible de créer ce compte avec ces informations.');
  }
  if (message.includes('Email not confirmed')) {
    // Do not reveal that an address belongs to an account during login.
    return new Error('Email ou mot de passe incorrect');
  }
  if (
    message.includes('email rate limit exceeded') ||
    message.includes('over_email_send_rate_limit')
  ) {
    return new Error(
      "Trop de demandes d'inscription ont été envoyées. Attendez quelques minutes avant de réessayer."
    );
  }
  if (message.includes('For security purposes, you can only request this after')) {
    return new Error(
      "Une demande d'inscription vient déjà d'être envoyée. Attendez un instant avant de recommencer."
    );
  }
  if (message.includes('Email address not authorized')) {
    // The provider can return this for password-reset delivery policy. Keep
    // SMTP allowlists and account existence out of the public response.
    return new Error("Impossible de traiter cette demande pour le moment.");
  }
  if (
    message.includes('Auth session missing') ||
    message.includes('Invalid Refresh Token') ||
    message.includes('refresh_token_not_found')
  ) {
    return new Error(
      'Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien.'
    );
  }
  if (
    message.includes('New password should be different') ||
    message.includes('same password')
  ) {
    return new Error('Choisissez un mot de passe différent de votre ancien mot de passe.');
  }

  return new Error("Une erreur d'authentification est survenue. Réessayez plus tard.");
}
