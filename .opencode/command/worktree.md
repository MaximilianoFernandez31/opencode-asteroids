---
description: Crea un git worktree en .worktrees usando un nombre en kebab-case.
---

Deduce un nombre breve y descriptivo para el worktree a partir del contexto actual de la conversación (tarea en curso, archivos mencionados, tema tratado). El nombre debe estar en kebab-case: minúsculas, sin acentos, palabras separadas por guiones (ej: fix-colisiones-asteroides).

Luego ejecuta:

git worktree add .worktrees/<nombre>

No hagas nada más.

Si el usuario pasó un nombre como argumento, úsalo (convertido a kebab-case):
$ARGUMENTS
