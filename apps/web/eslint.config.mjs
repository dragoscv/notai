import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from 'eslint-config-next';

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...nextPlugin,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            // React 19 plugin flags every legitimate mount-time external-state read
            // (localStorage, window, Tauri detection). We isolate those calls in client
            // components on purpose; disable the noisy rule rather than refactor each.
            'react-hooks/set-state-in-effect': 'off',
        },
    },
    { ignores: ['.next/**', 'node_modules/**', 'public/sw.js', 'next-env.d.ts'] },
);
