const authController = {
  mostrarLogin(req, res) {
    try {
        res.render('auth/login', {
            title: 'Iniciar Sesión',
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error("Error al renderizar la vista de login:", error);
        res.status(500).send("Error al cargar la página de login.");
    }
  }
};

module.exports = authController;
