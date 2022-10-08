region_by_code () {
    case $1 in
        euc1)
            echo eu-central-1 ;;
        use1)
            echo us-east-1 ;;
    esac
}
