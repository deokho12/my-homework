import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * PostgreSQL 이전 절차(docs/database/README.md §7.2)를 유효하게 유지하기 위한 검사.
 *
 * 사람 리뷰에 맡기지 않는다 — 편의로 한 번 넣으면 이전 시점까지 아무도 모른다.
 */

/**
 * 주석을 지운 소스. 금지 토큰 검사가 **문서를 위반으로 잡지 않게** 하려는 것이다 —
 * "$queryRaw 를 쓰지 않는 이유는…" 같은 주석이 실제로 여러 파일에 있다.
 *
 * 문자열 리터럴 안의 `//`(URL 등)도 함께 지워지지만, 우리는 그 뒤에 금지 토큰만
 * 찾으므로 거짓 양성은 생기지 않는다. 거짓 음성은 같은 줄에서 `//` 뒤 문자열 안에
 * 금지 토큰이 있을 때뿐이고 그런 코드는 없다.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')  // 블록 주석 (/** … */ 포함)
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // 줄 주석. 'https://' 의 ':' 를 살려 URL 오탐을 줄인다
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) return sourceFiles(path);

    return path.endsWith('.ts') ? [path] : [];
  });
}

const SOURCES = sourceFiles(join(__dirname, '..', 'src')).map((path) => ({
  path,
  content: readFileSync(path, 'utf8'),
}));

describe('PostgreSQL 이식성', () => {
  it('raw SQL ($queryRaw) 을 쓰지 않는다', () => {
    const offenders = SOURCES.filter((file) => {
      const stripped = stripComments(file.content);
      return stripped.includes('$queryRaw');
    });

    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it('raw SQL ($executeRaw) 을 쓰지 않는다', () => {
    const offenders = SOURCES.filter((file) => {
      const stripped = stripComments(file.content);
      return stripped.includes('$executeRaw');
    });

    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it("mode: 'insensitive' 를 쓰지 않는다 — SQLite 미지원이다", () => {
    const offenders = SOURCES.filter((file) => {
      const stripped = stripComments(file.content);
      return /mode:\s*['"]insensitive['"]/.test(stripped);
    });

    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it('스키마에 DB enum 이 없다', () => {
    const schema = readFileSync(join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
    const stripped = stripComments(schema);

    expect(stripped).not.toMatch(/^enum\s/m);
  });

  it('스키마에 Json 타입이 없다', () => {
    const schema = readFileSync(join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
    const stripped = stripComments(schema);

    expect(stripped).not.toContain('Json');
  });

  it('스키마에 autoincrement() 가 없다', () => {
    const schema = readFileSync(join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
    const stripped = stripComments(schema);

    expect(stripped).not.toContain('autoincrement()');
  });

  it('스키마에 @updatedAt 이 없다', () => {
    const schema = readFileSync(join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
    const stripped = stripComments(schema);

    expect(stripped).not.toContain('@updatedAt');
  });
});
