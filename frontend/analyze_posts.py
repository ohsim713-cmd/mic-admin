import json
from collections import defaultdict, Counter

# データ読み込み
with open('data/post_stock.json', 'r', encoding='utf-8') as f:
    post_data = json.load(f)

stocks = post_data.get('stocks', [])

# スコア別分類
high_score = [s for s in stocks if s.get('score', 0) >= 8]
mid_score = [s for s in stocks if 6 <= s.get('score', 0) < 8]
low_score = [s for s in stocks if s.get('score', 0) < 6]

print("="*60)
print("📊 投稿スコア分布分析")
print("="*60)
print(f"高スコア(8以上):  {len(high_score)} 件")
print(f"中スコア(6-7):   {len(mid_score)} 件")
print(f"低スコア(5以下): {len(low_score)} 件")
print(f"合計:           {len(stocks)} 件")
print()

# 高スコア投稿の詳細分析
print("="*60)
print("🎯 高スコア投稿（8以上）の詳細分析")
print("="*60)

# パターン分析
pattern_scores = defaultdict(list)
target_scores = defaultdict(list)
benefit_scores = defaultdict(list)

for stock in high_score:
    if stock.get('pattern'):
        pattern_scores[stock['pattern']].append(stock.get('score', 0))
    if stock.get('target'):
        target_scores[stock['target']].append(stock.get('score', 0))
    if stock.get('benefit'):
        benefit_scores[stock['benefit']].append(stock.get('score', 0))

# 平均スコア計算
pattern_avg = {k: sum(v)/len(v) for k, v in pattern_scores.items()}
target_avg = {k: sum(v)/len(v) for k, v in target_scores.items()}
benefit_avg = {k: sum(v)/len(v) for k, v in benefit_scores.items()}

print("\n✨ フックパターン効果度ランキング:")
for pattern, avg in sorted(pattern_avg.items(), key=lambda x: x[1], reverse=True):
    count = len(pattern_scores[pattern])
    print(f"  {pattern:20} → 平均スコア {avg:.2f} (n={count})")

print("\n🎯 対象セグメント効果度ランキング:")
for target, avg in sorted(target_avg.items(), key=lambda x: x[1], reverse=True):
    count = len(target_scores[target])
    print(f"  {target:20} → 平均スコア {avg:.2f} (n={count})")

print("\n💰 利益提案効果度ランキング:")
for benefit, avg in sorted(benefit_avg.items(), key=lambda x: x[1], reverse=True):
    count = len(benefit_scores[benefit])
    print(f"  {benefit:20} → 平均スコア {avg:.2f} (n={count})")

# スコア9の投稿を特定
score_9 = [s for s in stocks if s.get('score') == 9]
print("\n⭐ 最高スコア（9）の投稿分析:")
print(f"  該当件数: {len(score_9)} 件")
if score_9:
    for i, post in enumerate(score_9, 1):
        print(f"\n  【投稿{i}】")
        print(f"  パターン: {post.get('pattern')}")
        print(f"  対象: {post.get('target')}")
        print(f"  利益: {post.get('benefit')}")
        print(f"  アカウント: {post.get('account')}")

# すべてのパターン・セグメント・利益提案の一覧
print("\n📋 全パターン・セグメント・利益提案の集計:")
print(f"\nパターン種類: {len(pattern_scores)} 種類")
print(f"対象セグメント: {len(target_scores)} 種類")
print(f"利益提案: {len(benefit_scores)} 種類")

# 結果をJSONで出力
analysis_result = {
    "score_distribution": {
        "high": len(high_score),
        "mid": len(mid_score),
        "low": len(low_score),
        "total": len(stocks)
    },
    "pattern_ranking": sorted(pattern_avg.items(), key=lambda x: x[1], reverse=True),
    "target_ranking": sorted(target_avg.items(), key=lambda x: x[1], reverse=True),
    "benefit_ranking": sorted(benefit_avg.items(), key=lambda x: x[1], reverse=True),
    "high_score_count": len(score_9)
}

with open('analysis_result.json', 'w', encoding='utf-8') as f:
    json.dump(analysis_result, f, ensure_ascii=False, indent=2)

print("\n✅ 分析結果を analysis_result.json に保存しました")
