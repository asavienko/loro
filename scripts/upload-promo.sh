#!/usr/bin/env bash
# The promo video's files (apps/promo/out) to the landing page's media bucket (infra/landing/media.yaml),
# then the landing page pointed at them. Each file is stored under its content's hash, so it can be
# cached for a year and a new render never replaces what a cached page still points at. Idempotent:
# a file already uploaded is not sent again, and a page already pointing at it is left as it is.
set -euo pipefail
: "${AWS_REGION:?Set AWS_REGION}"
cd "$(dirname "$0")/.."
for tool in aws curl shasum perl; do command -v "$tool" >/dev/null; done
stack=${MEDIA_STACK_NAME:-loro-landing-media}
out=apps/promo/out
page=apps/landing/index.html

# name in out/ → content type. The page plays the MP4 and shows the poster; the WebM is there for
# embeds elsewhere.
files=(loro-promo-web.mp4:video/mp4 loro-promo.webm:video/webm loro-promo-poster.jpg:image/jpeg)
for entry in "${files[@]}"; do
  [[ -s $out/${entry%%:*} ]] || { echo "No $out/${entry%%:*}: run pnpm --filter @loro/promo video" >&2; exit 1; }
done

aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name "$stack" --template-file infra/landing/media.yaml --no-fail-on-empty-changeset
output() {
  aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
bucket=$(output Bucket)
base=$(output BaseUrl)
[[ $base == https://* ]] || { echo "No stack outputs: $base" >&2; exit 1; }

for entry in "${files[@]}"; do
  name=${entry%%:*}
  type=${entry#*:}
  hash=$(shasum -a 256 "$out/$name" | cut -c1-12)
  key="promo/${name%.*}.$hash.${name##*.}"
  if aws s3api head-object --region "$AWS_REGION" --bucket "$bucket" --key "$key" >/dev/null 2>&1; then
    echo "  have  $key"
  else
    aws s3 cp --region "$AWS_REGION" --only-show-errors "$out/$name" "s3://$bucket/$key" \
      --content-type "$type" --cache-control 'public, max-age=31536000, immutable'
    echo "  sent  $key"
  fi
  url="$base/$key"
  # The object answers anyone, over HTTPS, with its type.
  got=$(curl --fail --silent --show-error --head "$url" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2}')
  [[ $got == "$type" ]] || { echo "$url answered with type '$got'" >&2; exit 1; }
  # Point the page at this file: any earlier hash of the same name is replaced.
  stem=${name%.*}
  ext=${name##*.}
  URL=$url STEM=$stem EXT=$ext perl -pi -e 's#https://[^"\x27\s]+/promo/\Q$ENV{STEM}\E\.[0-9a-f]{12}\.\Q$ENV{EXT}\E#$ENV{URL}#g' "$page"
done

# The page's Content-Security-Policy must let it load from the bucket.
grep -q "media-src [^;]*$base" "$page" && grep -q "img-src [^;]*$base" "$page" || { echo "Add $base to media-src and img-src in $page's Content-Security-Policy" >&2; exit 1; }
echo "Promo files: $base/promo/  (bucket $bucket)"
