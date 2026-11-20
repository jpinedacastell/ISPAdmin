// Revisa que solo la capa de infraestructura use la base de datos.
// Uso: npm run check:db
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');

// Carpetas que sí pueden hablar con la BD
const PERMITIDOS = ['repositories', 'migrations', 'database', 'config'].map((carpeta) => path.join(SRC, carpeta) + path.sep);

// Un require de config/database (con cualquier ruta relativa) o de mysql2
const USO_DE_BD = /require\(\s*['"](?:\.{1,2}\/)+(?:[\w-]+\/)*config\/database(?:\.js)?['"]\s*\)|require\(\s*['"]mysql2(?:\/promise)?['"]\s*\)/;

function archivosJs(carpeta) {
    return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
        const ruta = path.join(carpeta, entrada.name);
        if (entrada.isDirectory()) return entrada.name === 'old' ? [] : archivosJs(ruta);
        return entrada.name.endsWith('.js') ? [ruta] : [];
    });
}

const infractores = archivosJs(SRC)
    .filter((archivo) => !PERMITIDOS.some((permitido) => archivo.startsWith(permitido)))
    .filter((archivo) => USO_DE_BD.test(fs.readFileSync(archivo, 'utf8')))
    .map((archivo) => path.relative(path.join(SRC, '..'), archivo));

if (infractores.length === 0) {
    console.log('OK: solo repositories/, migrations/, database/ y config/ usan la base de datos.');
    process.exit(0);
}

console.log(`Estos ${infractores.length} archivos usan la base de datos directamente:\n`);
infractores.forEach((archivo) => console.log(`  - ${archivo}`));
console.log('\nMueva las consultas a un repositorio en src/repositories/.');
process.exit(1);
