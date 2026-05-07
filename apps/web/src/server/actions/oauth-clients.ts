'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/auth';
import {
    db,
    oauthClients,
    oauthConsents,
    oauthTokens,
} from '@notai/db';
import {
    formatScopes,
    generateClientId,
    generateClientSecret,
    hashToken,
    intersectScopes,
} from '@notai/lib/oauth';

async function requireUser() {
    const session = await auth();
    if (!session?.user?.id) redirect('/signin');
    return session.user;
}

/** Apps the current user has consented to. */
export async function listConnectedApps() {
    const user = await requireUser();
    const rows = await db
        .select({
            consentId: oauthConsents.id,
            clientId: oauthClients.id,
            clientPublicId: oauthClients.clientId,
            name: oauthClients.name,
            description: oauthClients.description,
            logoUri: oauthClients.logoUri,
            clientUri: oauthClients.clientUri,
            type: oauthClients.type,
            dynamicallyRegistered: oauthClients.dynamicallyRegistered,
            scopes: oauthConsents.scopes,
            grantedAt: oauthConsents.createdAt,
            updatedAt: oauthConsents.updatedAt,
        })
        .from(oauthConsents)
        .innerJoin(oauthClients, eq(oauthConsents.clientId, oauthClients.id))
        .where(
            and(
                eq(oauthConsents.userId, user.id),
                isNull(oauthConsents.revokedAt),
                isNull(oauthClients.revokedAt),
            ),
        )
        .orderBy(desc(oauthConsents.updatedAt));
    return rows;
}

/** OAuth clients THIS user has registered themselves (developer view). */
export async function listMyClients() {
    const user = await requireUser();
    return db
        .select({
            id: oauthClients.id,
            clientId: oauthClients.clientId,
            name: oauthClients.name,
            type: oauthClients.type,
            redirectUris: oauthClients.redirectUris,
            allowedScopes: oauthClients.allowedScopes,
            dynamicallyRegistered: oauthClients.dynamicallyRegistered,
            createdAt: oauthClients.createdAt,
            revokedAt: oauthClients.revokedAt,
        })
        .from(oauthClients)
        .where(eq(oauthClients.ownerId, user.id))
        .orderBy(desc(oauthClients.createdAt));
}

const createSchema = z.object({
    name: z.string().min(1).max(120),
    redirectUris: z.array(z.string().url()).min(1).max(10),
    type: z.enum(['confidential', 'public']).default('confidential'),
    description: z.string().max(500).optional(),
    clientUri: z.string().url().optional(),
    logoUri: z.string().url().optional(),
    scope: z.string().optional(),
});

export async function createOauthClient(input: z.input<typeof createSchema>) {
    const user = await requireUser();
    const data = createSchema.parse(input);

    const allowed =
        'openid profile email offline_access notes:read notes:write notes:delete folders:read folders:write mcp';
    const scopes = data.scope ? formatScopes(intersectScopes(data.scope, allowed)) : allowed;

    const clientId = generateClientId();
    const secret = data.type === 'public' ? null : generateClientSecret();

    await db.insert(oauthClients).values({
        clientId,
        clientSecretHash: secret ? hashToken(secret) : null,
        type: data.type,
        name: data.name,
        description: data.description ?? null,
        logoUri: data.logoUri ?? null,
        clientUri: data.clientUri ?? null,
        redirectUris: data.redirectUris,
        allowedScopes: scopes,
        ownerId: user.id,
        dynamicallyRegistered: false,
    });

    revalidatePath('/app/settings/connected-apps');
    // Return secret ONCE — UI shows it on the next render then forgets it.
    return { clientId, clientSecret: secret };
}

export async function revokeConnectedApp(clientInternalId: string) {
    const user = await requireUser();

    await db
        .update(oauthConsents)
        .set({ revokedAt: new Date() })
        .where(
            and(
                eq(oauthConsents.userId, user.id),
                eq(oauthConsents.clientId, clientInternalId),
            ),
        );
    await db
        .update(oauthTokens)
        .set({ revokedAt: new Date() })
        .where(
            and(
                eq(oauthTokens.userId, user.id),
                eq(oauthTokens.clientId, clientInternalId),
                isNull(oauthTokens.revokedAt),
            ),
        );

    revalidatePath('/app/settings/connected-apps');
}

export async function revokeMyClient(clientInternalId: string) {
    const user = await requireUser();
    const [row] = await db
        .select({ id: oauthClients.id, ownerId: oauthClients.ownerId })
        .from(oauthClients)
        .where(eq(oauthClients.id, clientInternalId))
        .limit(1);
    if (!row || row.ownerId !== user.id) return;

    await db
        .update(oauthClients)
        .set({ revokedAt: new Date() })
        .where(eq(oauthClients.id, clientInternalId));
    await db
        .update(oauthTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(oauthTokens.clientId, clientInternalId), isNull(oauthTokens.revokedAt)));

    revalidatePath('/app/settings/connected-apps');
}
